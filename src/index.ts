import { XmppTrigger } from './nodes/Xmpp/XmppTrigger.node';
import { XmppSendFile } from './nodes/Xmpp/XmppSendFile.node';
import { XmppSendMessage } from './nodes/Xmpp/XmppSendMessage.node';
import { XmppApi } from './credentials/XmppApi.credentials';

export const nodes = [
  XmppTrigger,
  XmppSendFile,
  XmppSendMessage
];

export const credentials = [XmppApi];