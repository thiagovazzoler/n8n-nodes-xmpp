import {
    ITriggerFunctions, INodeType, INodeTypeDescription, ITriggerResponse,
} from 'n8n-workflow';

import XmppClientSingleton, { xml } from './connections/XmppClientSingleton';
import { RabbitClient } from './connections/RabbitClient';
import { v4 as uuidv4 } from 'uuid';
import { STATUS_CODES } from 'http';
import { on } from 'events';

type IbbSession = {
    from: string; to: string; sid: string; fileName?: string; fileSize?: number;
    chunks: string[]; blockSize?: number; startedAt: Date;
};

export class XmppTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'XMPP Listener',
        name: 'xmppTrigger',
        icon: 'file:xmpp.png',
        group: ['trigger'],
        version: 1,
        description: 'Escuta XMPP (mensagens e arquivos) e Filas do Rabbit (comandos de envio de mensagens e arquivos).',
        defaults: { name: 'XMPP Trigger' },
        inputs: [],
        outputs: ['main'],
        credentials: [
            { name: 'xmppApi', required: true, displayName: 'Connection XMPP' },
            { name: 'rabbitMqApi', required: true, displayName: 'Connection RabbitMq' },
        ],
        properties: [
            { displayName: 'Priority', name: 'priority', type: 'number', default: 10 },
            { displayName: 'IBB Timeout (s)', name: 'ibbTimeoutSec', type: 'number', default: 120 },
            { displayName: 'Emit Raw Stanza', name: 'emitRaw', type: 'boolean', default: false },
        ],
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
        try {
            const objCredencial_Xmpp = (await this.getCredentials('xmppApi')) as any;

            if (!objCredencial_Xmpp)
                throw new Error('Credencial XMPP não definida');

            const objCredencial_Rabbit = (await this.getCredentials('rabbitMqApi')) as any;

            if (!objCredencial_Rabbit)
                throw new Error('Credencial de conexão com o RabbitMq não definida.');

            const xmpp_Prioridade = this.getNodeParameter('priority', 0) as number;
            const emitRaw = this.getNodeParameter('emitRaw', 0) as boolean;
            const ibbTimeoutSec = (this.getNodeParameter('ibbTimeoutSec', 0) as number) ?? 120;
            const workflowId = String(this.getWorkflow().id);
            const key = `trigger:${workflowId}`;

            // XMPP online com presença/priority
            const objXmppClient = await XmppClientSingleton.getInstance({
                service: String(objCredencial_Xmpp.service),
                domain: String(objCredencial_Xmpp.domain),
                username: String(objCredencial_Xmpp.jid),
                password: String(objCredencial_Xmpp.password),
                presence: true,
                priority: xmpp_Prioridade
            }, key);

            // Rabbit
            const objRabbitClient = RabbitClient.getInstance();

            const ds_Rabbit_Url = objRabbitClient.Get_Rabbit_Url_Conexao(objCredencial_Rabbit);

            const nm_Xmpp_JID = String(objCredencial_Xmpp.jid).replace(/[^a-zA-Z0-9]/g, '_');

            const nm_Fila_Rabbit_Mensagem = `XMPP_MESSAGE_OUT_${nm_Xmpp_JID}`;
            const nm_Fila_Rabbit_Arquivos = `XMPP_FILE_OUT_${nm_Xmpp_JID}`;
            //const nm_Fila_Rabbit_Saida = `XMPP_EVENT_OUT_${nm_Xmpp_JID}`;

            await objRabbitClient.connect({ url: ds_Rabbit_Url });

            //VERIFICA SE AS FILAS EXISTEM, SE N EXISTIR, CRIA AS FILAS NO RABBIT
            await objRabbitClient.ensureQueues([
                nm_Fila_Rabbit_Mensagem,
                nm_Fila_Rabbit_Arquivos],
                { durable: true }
            );

            await objRabbitClient.setPrefetch(10);

            // --------- consumidores: enviar pelo XMPP a partir do Rabbit ----------
            // mensagens
            await objRabbitClient.consume(nm_Fila_Rabbit_Mensagem, async (msg, ch) => {

                if (!msg)
                    return;

                try {
                    console.log("Enviando mensagem... " + msg.content.toString());

                    const p = JSON.parse(msg.content.toString());
                    const to = String(p.to);
                    const body = String(p.body ?? p.message ?? '');
                    const stanza = xml('message', { type: 'chat', to }, xml('body', {}, body));

                    console.log("Mensagem a ser enviada: " + stanza.toString());

                    await XmppClientSingleton.send(stanza, key);

                    /**/
                    console.log("Mensagem enviado com sucesso...");

                    ch.ack(msg);
                } catch (e) {
                    ch.nack(msg, false, false);
                }
            });

            // arquivos via IBB
            await objRabbitClient.consume(nm_Fila_Rabbit_Arquivos, async (msg, ch) => {
                if (!msg)
                    return;

                try {
                    console.log("Enviando arquivo... ");

                    const p = JSON.parse(msg.content.toString());

                    await set_Enviar_Arquivo_XMPP({
                        xmpp: objXmppClient,
                        key,
                        toBare: String(p.to),
                        fileName: String(p.fileName ?? 'file.bin'),
                        fileBase64: String(p.fileBase64 ?? ''),
                    });

                     /**/
                    console.log("Arquivo enviado com sucesso...");

                    ch.ack(msg);
                } catch (e) {
                    ch.nack(msg, false, false);
                }
            });

            // --------- REGISTRA EVENTO DE RECEBIMENTO DE MENSAGENS VIA XMPP ----------
            const onMessage = async (evt: any) => {
                /*const payload = {
                    type: 'message',
                    from: evt.from,
                    body: evt.body,
                    time: evt.time
                };*/

                /*await objRabbitClient.publish(nm_Fila_Rabbit_Saida, payload);*/

                await this.emit([[{
                    json: {
                        status: true,
                        data: {
                            type: 'conversation',
                            body: evt.body,
                            from: evt.from,
                            file: {}
                        }
                    }
                }]]);
            };

            XmppClientSingleton.on('message', onMessage, key);

            // --------- REGISTRA EVENTO DE RECBIMENTO DE ARQUIVOS VIA XMPP (SI+IBB) ----------
            const sessions = new Map<string, IbbSession>();
            const timers = new Map<string, NodeJS.Timeout>();

            const armTimeout = (sid: string) => {
                const prev = timers.get(sid);

                if (prev)
                    clearTimeout(prev);

                const t = setTimeout(() => { sessions.delete(sid); timers.delete(sid); }, Math.max(5, ibbTimeoutSec) * 1000);

                timers.set(sid, t);
            };

            const clearSession = (sid: string) => {
                const p = timers.get(sid);

                if (p)
                    clearTimeout(p);

                timers.delete(sid);

                sessions.delete(sid);
            };

            const onStanza = async (stanza: any) => {
                if (emitRaw)
                    await

                        this.emit([[{ json: { type: 'raw-stanza', xml: stanza?.toString?.() ?? '', time: new Date() } }]]);

                // Oferta SI
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const si = stanza.getChild('si', 'http://jabber.org/protocol/si');
                    if (si) {
                        const file = si.getChild('file', 'http://jabber.org/protocol/si/profile/file-transfer');

                        const sid = si.attrs.id; const from = stanza.attrs.from;

                        sessions.set(sid, {
                            from,
                            to: stanza.attrs.to,
                            sid,
                            fileName:
                                file?.attrs?.name,
                            fileSize: file?.attrs?.size ? Number(file.attrs.size) : undefined,
                            chunks: [],
                            startedAt: new Date()
                        });

                        armTimeout(sid);

                        const acceptIQ = xml('iq', { type: 'result', to: from, id: stanza.attrs.id },
                            xml('si', { xmlns: 'http://jabber.org/protocol/si' },
                                xml('feature', { xmlns: 'http://jabber.org/protocol/feature-neg' },
                                    xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
                                        xml('field', { var: 'stream-method' }, xml('value', {}, 'http://jabber.org/protocol/ibb')),
                                    ),
                                ),
                            ),
                        );

                        await XmppClientSingleton.send(acceptIQ, key);

                        return;
                    }
                }

                // IBB open
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const open = stanza.getChild('open', 'http://jabber.org/protocol/ibb');
                    if (open) {
                        const sid = open.attrs.sid; const s = sessions.get(sid);

                        if (s) {
                            s.blockSize = open.attrs['block-size'] ? Number(open.attrs['block-size']) : undefined;
                            sessions.set(sid, s);
                            armTimeout(sid);
                        }

                        const res = xml('iq', { type: 'result', to: stanza.attrs.from, id: stanza.attrs.id });

                        await XmppClientSingleton.send(res, key);

                        return;
                    }
                }

                // IBB data
                if (stanza.is('message')) {
                    const dataEl = stanza.getChild('data', 'http://jabber.org/protocol/ibb');
                    if (dataEl) {
                        const sid = dataEl.attrs.sid;

                        if (sid && sessions.has(sid)) {
                            sessions.get(sid)!.chunks.push(dataEl.getText() || '');
                            armTimeout(sid);
                        }

                        return;
                    }
                }

                // IBB close
                if (stanza.is('iq') && stanza.attrs.type === 'set') {
                    const close = stanza.getChild('close', 'http://jabber.org/protocol/ibb');
                    if (close) {
                        const sid = close.attrs.sid;
                        const res = xml('iq', { type: 'result', to: stanza.attrs.from, id: stanza.attrs.id });

                        await XmppClientSingleton.send(res, key);

                        const sess = sessions.get(sid);
                        if (sess) {
                            const base64Content = sess.chunks.join('');
                            /*const payload = { type: 'file', from: sess.from, fileName: sess.fileName ?? 'file.bin', fileSize: sess.fileSize ?? null, base64: base64Content, sid, time: new Date() };*/

                            /* await objRabbitClient.publish(nm_Fila_Rabbit_Saida, payload);*/

                            await this.emit([[{
                                json: {
                                    status: true,
                                    data: {
                                        type: 'file',
                                        body: `Arquivo ${sess.fileName} recebido de ${sess.from}`,
                                        from: sess.from,
                                        file: {
                                            fileName: sess.fileName,
                                            mime: '',
                                            base64: base64Content
                                        }
                                    }
                                }
                            }]]);

                            clearSession(sid);
                        }
                        return;
                    }
                }
            };

            XmppClientSingleton.on('stanza', onStanza, key);

            const offFns = [
                () => XmppClientSingleton.off('message', onMessage, key),
                () => XmppClientSingleton.off('stanza', onStanza, key),
            ];

            return {
                closeFunction: async () => {
                    for (const off of offFns)
                        try {
                            off();
                        }
                        catch { }

                    /*FECHA CONEXÃO RABBITMQ*/
                    try {
                        await objRabbitClient.Set_Fechar_Conexao();
                    }
                    catch { }

                    /*FECHA CONEXÃO XMPP*/
                    try {
                        await XmppClientSingleton.reset(key);
                    } catch { }
                },
            };
        }
        catch (error: any) {
            throw new Error(error.message);
        }
    }
}

async function set_Enviar_Arquivo_XMPP(args: { xmpp: any; key: string; toBare: string; fileName: string; fileBase64: string; }) {
    const { xmpp, key, toBare, fileName, fileBase64 } = args;
    const to = (await (XmppClientSingleton as any).getJidResource?.(toBare, key)) ?? toBare;
    const fileBuffer = Buffer.from(fileBase64, 'base64'); const fileSize = fileBuffer.length;
    const sid = 'sid-' + uuidv4(); const blockSize = 2048;

    const offerIQ = xml('iq', { type: 'set', to, id: 'offer-' + sid },
        xml('si', { xmlns: 'http://jabber.org/protocol/si', id: sid, 'mime-type': 'application/octet-stream', profile: 'http://jabber.org/protocol/si/profile/file-transfer' },
            xml('file', { xmlns: 'http://jabber.org/protocol/si/profile/file-transfer', name: fileName, size: fileSize }),
            xml('feature', { xmlns: 'http://jabber.org/protocol/feature-neg' },
                xml('x', { xmlns: 'jabber:x:data', type: 'form' },
                    xml('field', { var: 'stream-method', type: 'list-single' },
                        xml('option', {}, xml('value', {}, 'http://jabber.org/protocol/ibb')))))));

    await xmpp.send(offerIQ);

    const openId = 'open-' + sid;

    await new Promise<void>((resolve, reject) => {
        const onStanza = async (stanza: any) => {
            try {
                if (stanza.is('iq') && stanza.attrs.type === 'result' && stanza.getChild('si')) {
                    const openIQ = xml('iq', { type: 'set', to, id: openId },
                        xml('open', { xmlns: 'http://jabber.org/protocol/ibb', sid, 'block-size': blockSize, stanza: 'message' }));

                    await xmpp.send(openIQ); return;
                }
                if (stanza.is('iq') && stanza.attrs.id === openId && stanza.attrs.type === 'result') {
                    let seq = 0;

                    for (let off = 0; off < fileBuffer.length; off += blockSize) {
                        const chunk = fileBuffer.slice(off, off + blockSize);
                        const b64 = chunk.toString('base64');
                        const dataStanza = xml('message', { to }, xml('data', { xmlns: 'http://jabber.org/protocol/ibb', sid, seq: String(seq) }, b64));

                        await xmpp.send(dataStanza); seq++;
                    }
                    const closeIQ = xml('iq', { type: 'set', to, id: openId }, xml('close', { xmlns: 'http://jabber.org/protocol/ibb', sid }));

                    await xmpp.send(closeIQ);

                    XmppClientSingleton.off('stanza', onStanza, key);

                    resolve();
                }
            } catch (e) {
                XmppClientSingleton.off('stanza', onStanza, key);

                reject(e);
            }
        };
        XmppClientSingleton.on('stanza', onStanza, key);
        setTimeout(() => { XmppClientSingleton.off('stanza', onStanza, key); reject(new Error('Timeout waiting IBB handshake')); }, 30000);
    });
}
