import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { RabbitClient } from '../connections/RabbitClient';


export async function sendFile(ef: IExecuteFunctions) {
    try {
        // --- credenciais ---
        const objCredencial_Rabbit = (await ef.getCredentials('rabbitMqApi')) as any;

        if (!objCredencial_Rabbit)
            throw new Error('RabbitMq connection credential not defined.');

        const objCredencial_Xmpp = (await ef.getCredentials('xmppApi')) as any;

        if (!objCredencial_Xmpp)
            throw new Error('XMPP Credential Not Set.');

        // --- fila dinâmica a partir do JID da credencial XMPP ---
        var nm_Xmpp_JID = String(objCredencial_Xmpp?.jid ?? '');

        if (!nm_Xmpp_JID)
            throw new Error('XMPP Credential without JID.');

        nm_Xmpp_JID = nm_Xmpp_JID.replace(/[^a-zA-Z0-9]/g, '_');

        const nm_Fila_Rabbit = `XMPP_FILE_OUT_${nm_Xmpp_JID}`;

        // --- parâmetros do node ---
        const nm_To_JID = ef.getNodeParameter('to', 0) as string;
        const nm_File = ef.getNodeParameter('fileName', 0) as string;
        const ds_File_Base64 = ef.getNodeParameter('fileBase64', 0) as string;

        if (!ds_File_Base64)
            throw new Error('fileBase64 is empty.');

        // --- publish no Rabbit (garante/cria a fila) ---
        const objRabbitClient = RabbitClient.getInstance();

        // --- URL do Rabbit ---
        const ds_Rabbit_Url = objRabbitClient.Get_Rabbit_Url_Conexao(objCredencial_Rabbit);

        await objRabbitClient.connect({ url: ds_Rabbit_Url });
        await objRabbitClient.ensureQueue(nm_Fila_Rabbit, { durable: true });

        await objRabbitClient.publish(nm_Fila_Rabbit, {
            to : nm_To_JID,
            file: {
                name: nm_File,
                base64: ds_File_Base64
            }
        });

        return {
            json: {
                status: true,
                data: {
                    message: `File successfully sent to queue ${nm_Fila_Rabbit}`
                }
            }
        };
    } catch (error: any) {
        throw new NodeOperationError(ef.getNode(), error.message);
    }
}
