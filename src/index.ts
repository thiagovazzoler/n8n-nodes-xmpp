import { XmppTrigger } from './nodes/Xmpp/XmppTrigger.node';
import { XmppSendMessage } from './nodes/Xmpp/XmppSendMessage.node';
import { XmppSendFile } from './nodes/Xmpp/XmppSendFile.node';

class XmppModule {
  static nodes = [
    XmppTrigger,
    XmppSendMessage,
    XmppSendFile,
  ];
}

export default {
  nodes: XmppModule.nodes,
};