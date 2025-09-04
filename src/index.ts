import { Xmpp } from './nodes/Xmpp/Xmpp.node';
import { XmppApi } from './credentials/XmppApi.credentials';
import { RabbitMqApi } from './credentials/RabbitMqApi.credentials';

export const nodes = [
  Xmpp
];

export const credentials = [
  XmppApi,
  RabbitMqApi,
];
