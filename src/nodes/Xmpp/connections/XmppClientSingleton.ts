import { client } from '@xmpp/client';
import xml from '@xmpp/xml';
import { EventEmitter } from 'events';

export interface XmppClientOptions {
    service: string;
    domain: string;
    username: string;      // JID local (sem /resource)
    password: string;
    resource?: string;     // opcional; se não vier, gera aleatório
    presence?: boolean;    // default: true (anunciar presença)
    priority?: number;     // default: 0 (só se presence=true)
    pingIntervalMs?: number; // default: 30000
    pingTimeoutMs?: number;  // default: 10000
}

type XmppKey = string;

type PresenceIndex = Map<string, { full: string; prio: number; when: number }>;

type InstanceState = {
    xmpp: any;
    bus: EventEmitter;
    online: boolean;
    pingTimer: NodeJS.Timeout | null;
    reconnectBackoffMs: number;
    listenersBound: boolean;
};


function randomId(len = 8) {
    // Gera id curto, compatível mesmo sem crypto.randomUUID
    return Math.random().toString(36).slice(2, 2 + len);
}

export default class XmppClientSingleton {
    private static instances: Map<XmppKey, InstanceState> = new Map();
    private static exitHookAttached = false;
    private static presenceByKey: Map<XmppKey, PresenceIndex> = new Map();

    private static bareOf(jid: string) {
        return jid.includes('/') ? jid.split('/')[0] : jid;
    }

    /** Retorna (ou cria) uma instância nomeada. Use chaves diferentes para trigger e actions. */
    public static async Get_Instance(
        opts: XmppClientOptions,
        key: XmppKey = 'default',
    ): Promise<any> {
        const existing = this.instances.get(key);
        if (existing?.xmpp) return existing.xmpp;

        const state: InstanceState = {
            xmpp: null,
            bus: new EventEmitter(),
            online: false,
            pingTimer: null,
            reconnectBackoffMs: 0,
            listenersBound: false,
        };

        // Resource aleatório por padrão
        const resource = opts.resource ?? `n8n-${randomId()}`;

        const xmpp = client({
            service: opts.service,
            domain: opts.domain,
            username: opts.username,
            password: opts.password,
            resource,
            reconnect: false, // nós mesmos gerimos reconexão
        });

        // Bind listeners (uma vez)
        if (!state.listenersBound) {
            xmpp.on('online', async (jid: any) => {
                state.online = true;
                state.reconnectBackoffMs = 0;

                // Presence opcional
                if (opts.presence !== false) {

                    const prio = Number.isFinite(opts.priority) ? String(opts.priority) : '0';

                    await xmpp.send(
                        xml(
                            'presence',
                            {},
                            xml('show', {}, 'chat'),
                            xml('status', {}, 'Online'),
                            xml('priority', {}, prio),
                        ),
                    );
                }

                state.bus.emit('online', jid);

                // Inicia ping keepalive
                this.startPing(key, opts);

                if (process.env.DEBUG_XMPP)
                    console.log(`✅ [${key}] XMPP online: ${jid?.toString?.() ?? ''}`);
            });

            xmpp.on('offline', () => {
                state.online = false;
                this.stopPing(key);
                this.scheduleReconnect(key, opts);

                if (process.env.DEBUG_XMPP)
                    console.warn(`⚠️ [${key}] XMPP offline`);
            });

            xmpp.on('status', (s: string) => {
                if (process.env.DEBUG_XMPP)
                    console.log(`📡 [${key}] status:`, s);
            });

            xmpp.on('error', (err: any) => {
                state.bus.emit('error', err);
                if (process.env.DEBUG_XMPP)
                    console.error(`❌ [${key}] XMPP error:`, err?.message || err);
            });

            // Multiplexa stanzas para quem quiser ouvir
            xmpp.on('stanza', (stanza: any) => {
                try {
                    // repassa a stanza crua
                    state.bus.emit('stanza', stanza);

                    // emite eventos simples (opcional)
                    if (stanza.is('message') && stanza.getChild('body')) {
                        state.bus.emit('message', {
                            from: stanza.attrs.from,
                            body: stanza.getChildText('body'),
                            stanza,
                            time: new Date(),
                        });
                    }
                } catch (e) {
                    if (process.env.DEBUG_XMPP) console.error(`❌ [${key}] stanza handler error:`, e);
                }
            });

            state.listenersBound = true;
        }

        state.xmpp = xmpp;
        this.instances.set(key, state);

        // Hook de saída do processo para fechar limpo
        if (!this.exitHookAttached) {
            process.on('exit', () => this.Set_Reset_Instance_All(true));
            this.exitHookAttached = true;
        }

        await xmpp.start();

        await XmppClientSingleton.Get_Wait_Until_Online(key, 20000);

        return xmpp;
    }

    /** Envia uma stanza usando a instância (default) */
    public static async Set_Event_Send(stanza: any, key: XmppKey = 'default') {
        const st = this.instances.get(key);

        console.log("Enviando mensagem: " + stanza.toString());

        if (!st?.xmpp)
            throw new Error(`XMPP[${key}] not started`);

        return st.xmpp.send(stanza);
    }

    /** Envia uma IQ e aguarda resposta (útil para SI/IBB etc.) */
    public static async Set_Event_Send_Receive(stanza: any, key: XmppKey = 'default') {
        const st = this.instances.get(key);

        if (!st?.xmpp)
            throw new Error(`XMPP[${key}] not started`);

        return st.xmpp.sendReceive(stanza);
    }

    /** Inscreve em eventos da instância (stanza, message, error, etc.) */
    public static Set_Event_On(event: string, cb: (...args: any[]) => void, key: XmppKey = 'default') {
        const st = this.instances.get(key);

        if (!st)
            throw new Error(`XMPP[${key}] not started`);

        st.bus.on(event, cb);
    }

    public static Set_Event_Off(event: string, cb: (...args: any[]) => void, key: XmppKey = 'default') {
        const st = this.instances.get(key);

        if (!st)
            return;

        st.bus.off(event, cb);
    }

    /** Fecha e limpa somente a instância da chave */
    public static async Set_Reset_Instance(key: XmppKey = 'default') {
        const st = this.instances.get(key);

        if (!st)
            return;

        this.stopPing(key);

        if (st.xmpp) {
            try {
                await st.xmpp.stop();
            }
            catch { }

            st.xmpp = null;
        }
        this.instances.delete(key);
    }

    /** Fecha e limpa TODAS as instâncias */
    public static async Set_Reset_Instance_All(onExit = false) {
        const keys = Array.from(this.instances.keys());
        for (const key of keys) {
            try { await this.Set_Reset_Instance(key); } catch { }
        }
        if (!onExit) this.exitHookAttached = false;
    }

    // ---------- Internals ----------

    private static startPing(key: XmppKey, opts: XmppClientOptions) {
        const st = this.instances.get(key);

        if (!st)
            return;

        this.stopPing(key);

        const intervalMs = Number(opts.pingIntervalMs ?? 30000);
        const timeoutMs = Number(opts.pingTimeoutMs ?? 10000);

        st.pingTimer = setInterval(async () => {
            if (!st.xmpp || !st.online) return;

            const id = `ping:${Date.now()}`;
            const pingIq = xml('iq', { type: 'get', id }, xml('ping', { xmlns: 'urn:xmpp:ping' }));

            let timeout: NodeJS.Timeout | null = null;

            const waiter = new Promise<void>((resolve, reject) => {
                const onStanza = (s: any) => {
                    if (s.is('iq') && s.attrs.id === id) {
                        st.xmpp.off('stanza', onStanza);
                        if (timeout) clearTimeout(timeout);
                        resolve();
                    }
                };
                st.xmpp.on('stanza', onStanza);
                timeout = setTimeout(() => {
                    st.xmpp.off('stanza', onStanza);
                    reject(new Error('Ping timeout'));
                }, timeoutMs);
            });

            try {
                await st.xmpp.send(pingIq);
                await waiter;
            } catch {
                // força ciclo de reconexão controlado
                try { await st.xmpp.stop(); } catch { }
            }
        }, intervalMs);
    }

    private static stopPing(key: XmppKey) {
        const st = this.instances.get(key);
        if (!st?.pingTimer) return;
        clearInterval(st.pingTimer);
        st.pingTimer = null;
    }

    private static scheduleReconnect(key: XmppKey, opts: XmppClientOptions) {
        const st = this.instances.get(key);
        if (!st) return;

        st.reconnectBackoffMs = Math.min(st.reconnectBackoffMs ? st.reconnectBackoffMs * 2 : 1000, 15000);

        setTimeout(async () => {
            const had = this.instances.get(key);
            if (!had) return;

            try {
                if (had.xmpp) { try { await had.xmpp.stop(); } catch { } }
            } catch { }
            // recria do zero
            try {
                await this.Get_Instance(opts, key);
            } catch {
                this.scheduleReconnect(key, opts);
            }
        }, st.reconnectBackoffMs);
    }

    /** Resolve um full JID (com /resource) a partir de um bare JID usando disco#items.
 *  Retorna null se o servidor não responder com itens.
 */
    public static async getJidResource(jidBare: string, key: string = 'default'): Promise<string | null> {
        const st = this.instances.get(key);
        if (!st?.xmpp) throw new Error(`XMPP[${key}] not started`);

        const bare = this.bareOf(jidBare);

        // 1) presence cache
        const idx = this.presenceByKey.get(key);
        const cached = idx?.get(bare)?.full;
        if (cached && cached.includes('/')) return cached;

        // 2) disco#info (alguns servidores retornam 'from' já com /resource)
        try {
            const infoId = `disco-info:${Date.now()}`;
            const iqInfo = xml('iq', { type: 'get', to: bare, id: infoId },
                xml('query', { xmlns: 'http://jabber.org/protocol/disco#info' }),
            );
            const resp = await st.xmpp.sendReceive(iqInfo);
            const from = resp?.attrs?.from;
            if (typeof from === 'string' && from.includes('/')) return from;
        } catch { }

        // 3) disco#items (fallback antigo)
        try {
            const itemsId = `disco-items:${Date.now()}`;
            const iq = xml('iq', { type: 'get', to: bare, id: itemsId },
                xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' }),
            );
            const response = await st.xmpp.sendReceive(iq);
            const queryEl = response.getChild('query', 'http://jabber.org/protocol/disco#items');
            const itemEl = queryEl?.getChild('item');
            const fullJid = itemEl?.attrs?.jid;
            if (typeof fullJid === 'string' && fullJid.includes('/')) return fullJid;
        } catch { }

        return null;
    }

    public static async Get_Wait_Until_Online(key: string = 'default', timeoutMs = 20000) {
        const st = this.instances.get(key);

        if (!st)
            throw new Error(`XMPP state not found for key=${key}`);

        if (st.online)
            return;

        await new Promise<void>((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('XMPP waitUntilOnline timeout')), timeoutMs);
            const onOnline = () => { clearTimeout(to); st.bus.off('online', onOnline); resolve(); };
            st.bus.on('online', onOnline);
        });
    }
}

export { xml };
