import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import XmppClientSingleton, { xml } from '../XmppClientSingleton';

export async function sendMessage(ef: IExecuteFunctions) {
    try {
        const creds = await ef.getCredentials('xmppApi');
        const { service, domain, jid, password } = creds;

        const to = ef.getNodeParameter('to', 0) as string;
        const body = ef.getNodeParameter('message', 0) as string;

        const xmpp = await XmppClientSingleton.getInstance({
            service: String(service),
            domain: String(domain),
            username: String(jid),
            password: String(password),
            presence: false,   // não participa do roteamento do bare JID
            priority: -128,
        });

        const stanza = xml('message', { type: 'chat', to }, xml('body', {}, body));
        await XmppClientSingleton.send(stanza);

        return { json: { ok: true, to, body } };
    } catch (error: any) {
        throw new NodeOperationError(ef.getNode(), error.message);
    } finally {
        try { await XmppClientSingleton.reset(); } catch { }
    }
}
