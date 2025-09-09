import { Xmpp } from './nodes/Xmpp/Xmpp.node';
import { XmppTrigger } from './nodes/Xmpp/XmppTrigger.node'; // <-- adicione isto
import { XmppApi } from './credentials/XmppApi.credentials';
import { RabbitMqApi } from './credentials/RabbitMqApi.credentials';
import XmppClientSingleton from './nodes/Xmpp/connections/XmppClientSingleton';

export const nodes = [
  Xmpp,
  XmppTrigger
];

export const credentials = [
  XmppApi,
  RabbitMqApi,
];