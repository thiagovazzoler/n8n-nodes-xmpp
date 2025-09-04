import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { RabbitClient } from '../connections/RabbitClient';

export async function sendMessage(ef: IExecuteFunctions) {
    try {
        // --- credenciais ---
        const objCredencial_Rabbit = (await ef.getCredentials('rabbitMqApi')) as any;

        if (!objCredencial_Rabbit)
            throw new Error('Credencial RabbitMq não definida.');

        const objCredencial_Xmpp = (await ef.getCredentials('xmppApi')) as any;

        if (!objCredencial_Xmpp)
            throw new Error('Credencial XMPP não definida');

        // --- fila dinâmica a partir do JID da credencial XMPP ---
        var nm_Xmpp_JID = String(objCredencial_Xmpp?.jid ?? '');

        nm_Xmpp_JID = nm_Xmpp_JID.replace(/[^a-zA-Z0-9]/g, '_');

        const nm_Fila_Rabbit = `XMPP_MESSAGE_OUT_${nm_Xmpp_JID}`;

        // --- parâmetros do node ---
        const nm_To = ef.getNodeParameter('to', 0) as string;
        const ds_Mensagem = ef.getNodeParameter('message', 0) as string;

        // --- publish no Rabbit (garante/cria a fila) ---
        const objRabbitClient = RabbitClient.getInstance();

        // --- URL do Rabbit ---
        const ds_Rabbit_Url = objRabbitClient.Get_Rabbit_Url_Conexao(objCredencial_Rabbit);

        await objRabbitClient.connect({ url: ds_Rabbit_Url });
        await objRabbitClient.ensureQueue(nm_Fila_Rabbit, { durable: true });

        await objRabbitClient.publish(nm_Fila_Rabbit, {
            to: nm_To,
            body: ds_Mensagem
        });

        return {
            json: {
                status: true,
                data: {
                    message: `Mensagem enviada com sucesso para a fila ${nm_Fila_Rabbit} `
                }
            }
        };
    } catch (error: any) {
        throw new NodeOperationError(ef.getNode(), error.message);
    }
}