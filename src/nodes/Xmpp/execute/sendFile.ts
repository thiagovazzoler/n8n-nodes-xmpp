import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import XmppClientSingleton, { xml } from '../XmppClientSingleton';
import { v4 as uuidv4 } from 'uuid';

export async function sendFile(ef: IExecuteFunctions) {
    try {
        const creds = await ef.getCredentials('xmppApi');
        const { service, domain, jid, password } = creds;

        const toBare = ef.getNodeParameter('to', 0) as string;
        const fileBase64 = ef.getNodeParameter('fileBase64', 0) as string;
        const fileName = ef.getNodeParameter('fileName', 0) as string;

        const fileBuffer = Buffer.from(fileBase64, 'base64');
        const fileSize = fileBuffer.length;
        const sid = 'sid-' + uuidv4() + '-arquivo';
        const blockSize = 2048;

        const xmpp = await XmppClientSingleton.getInstance({
            service: String(service),
            domain: String(domain),
            username: String(jid),
            password: String(password),
            presence: false,
            priority: -128,
        });

        const toResolved = (await XmppClientSingleton.getJidResource(toBare)) ?? toBare;

        // 1) Oferta (SI)
        const offerIQ = xml(
            'iq',
            { type: 'set', to: toResolved, id: 'offer-1' },
            xml(
                'si',
                {
                    xmlns: 'http://jabber.org/protocol/si',
                    id: sid,
                    'mime-type': 'application/octet-stream',
                    profile: 'http://jabber.org/protocol/si/profile/file-transfer',
                },
                xml(
                    'file',
                    {
                        xmlns: 'http://jabber.org/protocol/si/profile/file-transfer',
                        name: fileName,
                        size: fileSize,
                    },
                ),
                xml(
                    'feature',
                    { xmlns: 'http://jabber.org/protocol/feature-neg' },
                    xml(
                        'x',
                        { xmlns: 'jabber:x:data', type: 'form' },
                        xml(
                            'field',
                            { var: 'stream-method', type: 'list-single' },
                            xml('option', {}, xml('value', {}, 'http://jabber.org/protocol/ibb')),
                        ),
                    ),
                ),
            ),
        );
        await xmpp.send(offerIQ);

        const openId = 'open-' + uuidv4();

        // 2) Handshake + envio
        await new Promise<void>((resolve, reject) => {
            const onStanza = async (stanza: any) => {
                try {
                    if (stanza.is('iq') && stanza.attrs.type === 'result' && stanza.getChild('si')) {
                        const openIQ = xml(
                            'iq',
                            { type: 'set', to: toResolved, id: openId },
                            xml('open', { xmlns: 'http://jabber.org/protocol/ibb', sid, 'block-size': blockSize, stanza: 'message' }),
                        );
                        await xmpp.send(openIQ);
                        return;
                    }

                    if (stanza.is('iq') && stanza.attrs.id === openId && stanza.attrs.type === 'result') {
                        let seq = 0;
                        for (let offset = 0; offset < fileBuffer.length; offset += blockSize) {
                            const chunk = fileBuffer.slice(offset, offset + blockSize);
                            const base64Chunk = chunk.toString('base64');
                            const dataStanza = xml(
                                'message',
                                { to: toResolved },
                                xml('data', { xmlns: 'http://jabber.org/protocol/ibb', sid, seq: String(seq) }, base64Chunk),
                            );
                            await xmpp.send(dataStanza);
                            seq++;
                        }

                        const closeIQ = xml(
                            'iq',
                            { type: 'set', to: toResolved, id: openId },
                            xml('close', { xmlns: 'http://jabber.org/protocol/ibb', sid }),
                        );
                        await xmpp.send(closeIQ);

                        xmpp.off('stanza', onStanza);
                        resolve();
                        return;
                    }
                } catch (e) {
                    xmpp.off('stanza', onStanza);
                    reject(e);
                }
            };

            xmpp.on('stanza', onStanza);
            setTimeout(() => {
                xmpp.off('stanza', onStanza);
                reject(new Error('Timeout waiting IBB handshake'));
            }, 30000);
        });

        return { json: { ok: true, to: toBare, fileName, size: fileSize } };
    } catch (error: any) {
        throw new NodeOperationError(ef.getNode(), error.message);
    } finally {
        try { await XmppClientSingleton.reset(); } catch { }
    }
}
