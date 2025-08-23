import { client } from '@xmpp/client';
import xml from '@xmpp/xml';

interface XmppClientOptions {
    service: string;
    domain: string;
    username: string; // JID
    password: string;
}

class XmppClientSingleton {
    private static instance: any;

    private constructor() {
        // Construtor privado para evitar instanciações externas
    }

    public static async getInstance(options?: XmppClientOptions): Promise<any> {
        if (!XmppClientSingleton.instance) {
            if (!options) {
                throw new Error('XmppClientSingleton: First call requires connection parameters.');
            }

             console.log('[PID]', process.pid, 'Trigger...');

            const xmpp = client({
                service: options.service,
                domain: options.domain,
                username: options.username,
                password: options.password,
                resource: "n8n"
            });

            this.instance = xmpp;

            // Aqui você pode configurar os eventos padrões se quiser:
            this.instance.on('online', (address: any) => {
                console.log('✅ XMPP connect', address.toString());

                this.instance.send(xml('presence'));
            });

            // Aqui você pode configurar os eventos padrões se quiser:
            this.instance.on('error', (err: any) => {
                console.error('❌ XMPP Error:', err);
            });

            this.instance.on('status', (status: any) => {
                console.log('📡 XMPP Status:', status);
            });

            try {
                await this.instance.start();
            } catch (err) {
                this.instance = null;
                console.error('❌ XMPP client error:', err);
                throw new Error(`XMPP Error client: ${err}`);; // Repassar erro para o chamador (ex: trigger)
            }
        }

        return await this.instance;
    }

    public static async getJidResource(jidUser: string): Promise<string | null> {
        try {
            const id = `disco-${Date.now()}`;

            const iq = xml(
                'iq',
                { type: 'get', to: jidUser, id: id },
                xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' })
            );

            if (!this.instance) {
                throw new Error('XmppClientSingleton: not instantiated');
            }

            const jid = await new Promise<any>(async (resolve, reject) => {
                const response = await this.instance.sendReceive(iq);

                // Encontrar o elemento <item>
                const queryElement = response.getChild('query', 'http://jabber.org/protocol/disco#items');

                if (!queryElement)
                    reject(null);

                const itemElement = queryElement.getChild('item');

                if (!itemElement)
                    reject(null);

                const jid = itemElement.attrs?.jid;

                resolve(jid);
            });

            return jid || null;

        } catch (err) {
            console.error('❌ Error getting resource:', err);

            throw new Error('Error getJidResource');
        }
    }

    public static async reset(): Promise<void> {
        if (this.instance) {
            try {
                await this.instance.close();
            }
            catch (err) {
                console.error('❌ Error disconnecting XMPP:', err);
            } finally {
                this.instance = null;
            }
        }
    }
}

export default XmppClientSingleton;
