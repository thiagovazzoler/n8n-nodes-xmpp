import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import XmppClientSingleton from './XmppClientSingleton';
import xml from '@xmpp/xml';
import { v4 as uuidv4 } from 'uuid';

export class XmppSendFile implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'XMPP Send File',
        name: 'xmppSendFile',
        icon: 'file:xmpp.png',
        group: ['transform'],
        version: 1,
        description: 'Send files to an XMPP user via Openfire using IBB (XEP-0047)',
        defaults: {
            name: 'XMPP Send File',
        },
        inputs: ['main'],
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
            {
                displayName: 'To (JID)',
                name: 'to',
                type: 'string',
                default: '',
                placeholder: 'ex: user@domain',
                required: true,
            },
            {
                displayName: 'File (Base64)',
                name: 'fileBase64',
                type: 'string',
                default: '',
                required: true,
            },
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: 'file.pdf',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

        const returnData: INodeExecutionData[] = [];

        try {
            const credentials = await this.getCredentials('xmppApi');
            const { service, domain, jid, password } = credentials;

            const xmppClient = await XmppClientSingleton.getInstance({
                service: service.toString(),
                domain: domain.toString(),
                username: jid.toString(),
                password: password.toString(),
            });

            let to = this.getNodeParameter('to', 0) as string;
            const fileName = this.getNodeParameter('fileName', 0) as string;
            const fileBase64Input = this.getNodeParameter('fileBase64', 0) as string;
            const fileBuffer = Buffer.from(fileBase64Input, 'base64');
            const fileSize = fileBuffer.length;
            const sid = "sid-" + uuidv4() + "-arquivo"; // ID da sessão única
            const blockSize = 2048;

            const toJidResource = await XmppClientSingleton.getJidResource(to);

            if (!toJidResource) {
                throw new Error(`Unable to obtain resource for JID: ${to}`);
            }

            // 🔗 Conexão
            // 1. Envia oferta SI (com sid definido)
            const offerIQ = xml(
                "iq",
                { type: "set", to: toJidResource, id: "offer-1" },
                xml(
                    "si",
                    {
                        xmlns: "http://jabber.org/protocol/si",
                        id: sid,
                        "mime-type": "application/pdf",
                        profile: "http://jabber.org/protocol/si/profile/file-transfer",
                    },
                    xml(
                        "file",
                        {
                            xmlns: "http://jabber.org/protocol/si/profile/file-transfer",
                            name: fileName,
                            size: fileSize,
                        }
                    ),
                    xml(
                        "feature",
                        { xmlns: "http://jabber.org/protocol/feature-neg" },
                        xml(
                            "x",
                            { xmlns: "jabber:x:data", type: "form" },
                            xml("field", { var: "stream-method", type: "list-single" },
                                xml("option", {}, xml("value", {}, "http://jabber.org/protocol/ibb"))
                            )
                        )
                    )
                )
            );

            await xmppClient.send(offerIQ);
            console.log("📤 File Offer Sent");

            //Id de abertura
            const openId = "open-" + uuidv4();

            // 2. Escuta resposta do peer
            xmppClient.on("stanza", async (stanza: any) => {
                if (stanza.is("iq") && stanza.attrs.type === "result" && stanza.getChild("si")) {
                    console.log("📩 Peer accepted the offer, trading IBB...");

                    // 3. Abre sessão IBB
                    const openIQ = xml(
                        "iq",
                        { type: "set", to: toJidResource, id: openId},
                        xml(
                            "open",
                            {
                                xmlns: "http://jabber.org/protocol/ibb",
                                sid,
                                "block-size": blockSize,
                                stanza: "message",
                            }
                        )
                    );
                    await xmppClient.send(openIQ);
                    console.log("📤 Requesting IBB opening...");
                }

                // 4. Recebe confirmação de abertura
                if (stanza.is("iq") && stanza.attrs.id === openId && stanza.attrs.type === "result") {
                    console.log("✅ IBB channel open, sending data...");

                    // Divide arquivo em blocos
                    let seq = 0;
                    for (let offset = 0; offset < fileBuffer.length; offset += blockSize) {
                        const chunk = fileBuffer.slice(offset, offset + blockSize);
                        const base64Chunk = chunk.toString("base64");

                        const dataStanza = xml(
                            "message",
                            { to: toJidResource },
                            xml(
                                "data",
                                { xmlns: "http://jabber.org/protocol/ibb", sid, seq: seq.toString() },
                                base64Chunk
                            )
                        );

                        await xmppClient.send(dataStanza);

                        console.log(`📤 Block ${seq} send (${chunk.length} bytes)`);
                        seq++;
                    }

                    // 5. Fecha a sessão IBB
                    const closeIQ = xml(
                        "iq",
                        { type: "set", to: toJidResource, id: openId },
                        xml("close", { xmlns: "http://jabber.org/protocol/ibb", sid })
                    );
                    await xmppClient.send(closeIQ);

                    console.log("✅ File sent and IBB session closed");
                }
            });

            returnData.push({
                json: {
                    status: true,
                    data: {
                        message: `File ${fileName} sent successfully`,
                    }
                },
            });

            return [returnData];
        }
        catch (error) {
            throw new NodeOperationError(this.getNode(), (error as Error).message);
        }
    }
}
