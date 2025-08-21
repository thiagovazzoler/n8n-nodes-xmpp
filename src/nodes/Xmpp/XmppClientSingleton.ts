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
            const xmpp = client({
                service: options.service,
                domain: options.domain,
                username: options.username,
                password: options.password,
            });

            XmppClientSingleton.instance = xmpp;

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

           // Start com timeout
            try {
                await Promise.race([
                    xmpp.start(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('XMPP start timeout')), 10000))
                ]);
            } catch (err) {
                XmppClientSingleton.instance = null;
                console.error('❌ XMPP client error:', err);
                throw err;
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
                await Promise.race([
                    this.instance.stop(), 
                    new Promise((_, reject) => setTimeout(() => reject(new Error('XMPP close timeout')), 5000))
                ]);
            } catch (err) {
                console.error('❌ Error disconnecting XMPP:', err);
            } finally {
                this.instance = null;
            }
        }
    }
}

export default XmppClientSingleton;
