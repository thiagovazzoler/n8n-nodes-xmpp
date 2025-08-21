import {
  ITriggerFunctions,
  ITriggerResponse,
  INodeType,
  INodeTypeDescription,
  INodeExecutionData,
  NodeOperationError
} from 'n8n-workflow';

import XmppClientSingleton from './XmppClientSingleton';
import xml from '@xmpp/xml';

const SESSIONS = new Map<string, any>();

export class XmppTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'XMPP Trigger',
    name: 'xmppTrigger',
    icon: 'file:xmpp.png',
    group: ['trigger'],
    version: 1,
    description: 'Trigger for XMPP messages',
    defaults: {
      name: 'XMPP Trigger',
    },
    inputs: [],
    outputs: ['main'],
    codex: {
      categories: ['XMPP']
    },
    credentials: [
      {
        name: 'xmppApi',
        required: true,
      },
    ],
    properties: [
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    console.log('🚀 Starting XmppTrigger...');

    try {
      const credentials = await this.getCredentials('xmppApi');
      const { service, domain, jid, password } = credentials;

      const xmppClient = await XmppClientSingleton.getInstance({
        service: service.toString(),
        domain: domain.toString(),
        username: jid.toString(),
        password: password.toString(),
      });

      xmppClient.options.resource = 'n8n';

      xmppClient.on('stanza', async (stanza: any) => {
        if (stanza.is('message') && stanza.getChild('body')) {
          const from = stanza.attrs.from;
          const body = stanza.getChildText('body');
          const type = "message"

          console.log('📩 Message received from', from, '->', body);

          this.emit([
            [
              {
                json: {
                  from,
                  type,
                  body,
                  stanza: stanza.toString(),
                },
              },
            ],
          ]);
          return;
        }

        // Processar IQ para arquivo
        if (stanza.is('iq') && stanza.attrs.type === 'set') {
          const si = stanza.getChild('si', 'http://jabber.org/protocol/si');

          if (si) {
            const file = si.getChild('file', 'http://jabber.org/protocol/si/profile/file-transfer');

            if (!file)
              return;

            const sid = si.attrs.id;
            const from = stanza.attrs.from;
            const fileName = file.attrs.name || 'file_received';
            const fileSize = parseInt(file.attrs.size || '0', 10);

            console.log(`📩 Receiving file from ${from}: ${fileName} (${fileSize} bytes)`);

            SESSIONS.set(sid, { from, fileName, fileSize, chunks: [] });

            const acceptIQ = xml(
              'iq',
              { type: 'result', to: from, id: stanza.attrs.id },
              xml('si', { xmlns: 'http://jabber.org/protocol/si' },
                xml('feature', { xmlns: 'http://jabber.org/protocol/feature-neg' },
                  xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
                    xml('field', { var: 'stream-method' },
                      xml('value', {}, 'http://jabber.org/protocol/ibb')
                    )
                  )
                )
              )
            );

            await xmppClient.send(acceptIQ);

            return;
          }

          const open = stanza.getChild('open', 'http://jabber.org/protocol/ibb');
          if (open) {
            console.log(`Open ${stanza}`);

            const sid = open.attrs.sid;
            const from = stanza.attrs.from;
            const blockSize = parseInt(open.attrs['block-size'] || '4096', 10);

            const session = SESSIONS.get(sid);
            if (!session) return;

            session.blockSize = blockSize;

            const resultIQ = xml('iq', { type: 'result', to: from, id: stanza.attrs.id });
            await xmppClient.send(resultIQ);
            return;
          }

          const data = stanza.getChild('data', 'http://jabber.org/protocol/ibb');
          if (data) {
            const sid = data.attrs.sid;
            const session = SESSIONS.get(sid);
            if (!session) return;

            const bin = Buffer.from(data.getText(), 'base64');
            session.chunks.push(bin);

            const resultIQ = xml('iq', { type: 'result', to: stanza.attrs.from, id: stanza.attrs.id });
            await xmppClient.send(resultIQ);
            return;
          }

          const close = stanza.getChild('close', 'http://jabber.org/protocol/ibb');
          if (close) {
            const sid = close.attrs.sid;
            const session = SESSIONS.get(sid);
            if (session) {
              const fileBuffer = Buffer.concat(session.chunks);
              const base64Content = fileBuffer.toString('base64');

              // Emitir o arquivo completo via trigger com base64
              const output: INodeExecutionData[] = [
                {
                  json: {
                    time: new Date(),
                    type: 'file',
                    from: session.from,
                    fileName: session.fileName,
                    size: fileBuffer.length,
                    mime: 'application/octet-stream',
                    base64: base64Content,
                  },
                },
              ];

              await this.emit([output]);

              SESSIONS.delete(sid);
            }

            const resultIQ = xml('iq', { type: 'result', to: stanza.attrs.from, id: stanza.attrs.id });

            await xmppClient.send(resultIQ);

            return;
          }
        }
      });

      return {
        closeFunction: async () => {
          console.error('❌ Disconnecting');

          await XmppClientSingleton.reset();
        },
      };

    }
    catch (error) {
      console.error('Error starting XmppTrigger:', error);

      throw new NodeOperationError(this.getNode(), (error as Error).message);
    }
  }
}
