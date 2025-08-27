import {
    ITriggerFunctions,
    INodeType,
    INodeTypeDescription,
    ITriggerResponse,
} from 'n8n-workflow';


import XmppClientSingleton, { xml } from './XmppClientSingleton';

type IbbSession = {
    from: string;
    to: string;
    sid: string;
    fileName?: string;
    fileSize?: number;
    chunks: string[];     // base64 chunks
    blockSize?: number;
    startedAt: Date;
};

export class XmppTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'XMPP Trigger',
        name: 'xmppTrigger',
        icon: 'file:xmpp.png',
        group: ['trigger'],
        version: 1,
        description: 'Listen to XMPP messages and file transfers (SI + IBB)',
        defaults: { name: 'XMPP Trigger' },
        inputs: [],
        outputs: ['main'],
        credentials: [{ name: 'xmppApi', required: true }],
        properties: [
            {
                displayName: 'Priority',
                name: 'priority',
                type: 'number',
                default: 10,
                description:
                    'Priority for this resource. Higher priority ensures this trigger receives messages when multiple resources are connected.',
            },
            {
                displayName: 'Emit Raw Stanza Events',
                name: 'emitRaw',
                type: 'boolean',
                default: false,
                description:
                    'If enabled, emit additional events with raw stanza XML for debugging (can be verbose).',
            },
            {
                displayName: 'IBB Timeout (seconds)',
                name: 'ibbTimeoutSec',
                type: 'number',
                default: 120,
                description: 'Timeout to wait for IBB data/close after open.',
            },
        ],
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
        const creds = await this.getCredentials('xmppApi');
        const { service, domain, jid, password } = creds;

        const priority = this.getNodeParameter('priority', 0) as number;
        const emitRaw = this.getNodeParameter('emitRaw', 0) as boolean;
        const ibbTimeoutSec = (this.getNodeParameter('ibbTimeoutSec', 0) as number) ?? 120;

        // instancia dedicada da TRIGGER (presence: true)
        await XmppClientSingleton.getInstance(
            {
                service: String(service),
                domain: String(domain),
                username: String(jid),
                password: String(password),
                presence: true,
                priority,
            },
            'trigger',
        );

        const sessions = new Map<string, IbbSession>(); // sid -> session
        const timers = new Map<string, NodeJS.Timeout>(); // sid -> timeout

        const offFns: Array<() => void> = [];

        const armTimeout = (sid: string) => {
            // limpa e reprograma timeout por sid
            const prev = timers.get(sid);
            if (prev) clearTimeout(prev);
            const t = setTimeout(() => {
                // timeout — descarta sessão incompleta
                sessions.delete(sid);
                timers.delete(sid);
            }, Math.max(5, ibbTimeoutSec) * 1000);
            timers.set(sid, t);
        };

        const clearSession = (sid: string) => {
            const prev = timers.get(sid);
            if (prev) clearTimeout(prev);
            timers.delete(sid);
            sessions.delete(sid);
        };

        // -------------------------------
        // Mensagens de texto (simples)
        // -------------------------------
        const onMessage = async (evt: any) => {
            try {
                await this.emit([
                    [
                        {
                            json: {
                                type: 'message',
                                from: evt.from,
                                body: evt.body,
                                time: evt.time,
                            },
                        },
                    ],
                ]);
            } catch (e) {
                // só loga; não derruba
                // eslint-disable-next-line no-console
                console.error('[XMPP Trigger] emit message error:', e);
            }
        };

        XmppClientSingleton.on('message', onMessage, 'trigger');
        
        offFns.push(() => XmppClientSingleton.off('message', onMessage, 'trigger'));

        // -------------------------------
        // Stanzas (SI + IBB)
        // -------------------------------
        const onStanza = async (stanza: any) => {
            try {
                if (emitRaw) {
                    await this.emit([
                        [
                            {
                                json: {
                                    type: 'raw-stanza',
                                    name: stanza?.name || 'stanza',
                                    from: stanza?.attrs?.from,
                                    to: stanza?.attrs?.to,
                                    id: stanza?.attrs?.id,
                                    stanza: stanza?.toString?.() ?? '',
                                    time: new Date(),
                                },
                            },
                        ],
                    ]);
                }

                // 1) Oferta SI (file-transfer) -> aceitar com IBB
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const si = stanza.getChild('si', 'http://jabber.org/protocol/si');
                    if (si) {
                        const sid = si.attrs.id;
                        const from = stanza.attrs.from;
                        const to = stanza.attrs.to;

                        // tenta extrair metadados do arquivo
                        const fileEl = si.getChild(
                            'file',
                            'http://jabber.org/protocol/si/profile/file-transfer',
                        );
                        const fileName = fileEl?.attrs?.name;
                        const fileSize = fileEl?.attrs?.size ? Number(fileEl.attrs.size) : undefined;

                        // registra (ou atualiza) a sessão
                        sessions.set(sid, {
                            from,
                            to,
                            sid,
                            fileName,
                            fileSize,
                            chunks: [],
                            startedAt: new Date(),
                        });
                        armTimeout(sid);

                        // responder RESULT escolhendo IBB
                        const id = stanza.attrs.id;
                        const result = xml(
                            'iq',
                            { type: 'result', to: from, id },
                            xml(
                                'si',
                                { xmlns: 'http://jabber.org/protocol/si' },
                                xml(
                                    'feature',
                                    { xmlns: 'http://jabber.org/protocol/feature-neg' },
                                    xml(
                                        'x',
                                        { xmlns: 'jabber:x:data', type: 'submit' },
                                        xml(
                                            'field',
                                            { var: 'stream-method' },
                                            xml('value', {}, 'http://jabber.org/protocol/ibb'),
                                        ),
                                    ),
                                ),
                            ),
                        );

                        await XmppClientSingleton.send(result, 'trigger');

                        // também podemos emitir um evento "file-offer" informativo
                        await this.emit([
                            [
                                {
                                    json: {
                                        type: 'file-offer',
                                        from,
                                        fileName,
                                        fileSize,
                                        sid,
                                        time: new Date(),
                                    },
                                },
                            ],
                        ]);

                        return;
                    }
                }

                // 2) Recebe OPEN (IBB)
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const open = stanza.getChild('open', 'http://jabber.org/protocol/ibb');
                    if (open) {
                        const sid = open.attrs.sid;
                        const blockSize = open.attrs['block-size']
                            ? Number(open.attrs['block-size'])
                            : undefined;

                        const s = sessions.get(sid);
                        if (s) {
                            s.blockSize = blockSize;
                            sessions.set(sid, s);
                            armTimeout(sid);
                        }

                        // responder result ao OPEN
                        const id = stanza.attrs.id;
                        const from = stanza.attrs.from;
                        const res = xml('iq', { type: 'result', to: from, id });
                        await XmppClientSingleton.send(res, 'trigger');

                        return;
                    }
                }

                // 3) Recebe CHUNKS <data> em <message>
                if (stanza.is('message')) {
                    const dataEl = stanza.getChild('data', 'http://jabber.org/protocol/ibb');
                    if (dataEl) {
                        const sid = dataEl.attrs.sid;
                        const chunk = dataEl.getText() || '';
                        if (sid && sessions.has(sid)) {
                            sessions.get(sid)!.chunks.push(chunk);
                            armTimeout(sid);
                        }
                        return;
                    }
                }

                // 4) Recebe CLOSE (IBB)
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const close = stanza.getChild('close', 'http://jabber.org/protocol/ibb');
                    if (close) {
                        const sid = close.attrs.sid;
                        const id = stanza.attrs.id;
                        const from = stanza.attrs.from;

                        // responder result ao CLOSE
                        const res = xml('iq', { type: 'result', to: from, id });
                        await XmppClientSingleton.send(res, 'trigger');

                        // montar arquivo final
                        const sess = sessions.get(sid);
                        if (sess) {
                            const { fileName, fileSize, chunks } = sess;
                            const base64Content = chunks.join('');

                            // emitir arquivo recebido
                            await this.emit([
                                [
                                    {
                                        json: {
                                            type: 'file',
                                            from: sess.from,
                                            fileName: fileName ?? 'file.bin',
                                            fileSize: fileSize ?? null,
                                            base64: base64Content,
                                            sid,
                                            time: new Date(),
                                        },
                                    },
                                ],
                            ]);

                            clearSession(sid);
                        }
                        return;
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('[XMPP Trigger] stanza handler error:', e);
            }
        };

        XmppClientSingleton.on('stanza', onStanza, 'trigger');
        offFns.push(() => XmppClientSingleton.off('stanza', onStanza, 'trigger'));

        return {
            closeFunction: async () => {
                // remove listeners, mas NÃO fecha a conexão da trigger
                for (const off of offFns) {
                    try {
                        off();
                    } catch { }
                }
                // limpa timeouts/sessões
                for (const t of timers.values()) clearTimeout(t);
                timers.clear();
                sessions.clear();
            },
        };
    }
}
