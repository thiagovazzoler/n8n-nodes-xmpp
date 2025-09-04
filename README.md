# n8n-nodes-xmpp

![Banner](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-xmpp.svg)](https://www.npmjs.com/package/n8n-nodes-xmpp)
[![npm downloads](https://img.shields.io/npm/dt/n8n-nodes-xmpp.svg)](https://www.npmjs.com/package/n8n-nodes-xmpp)
[![GitHub issues](https://img.shields.io/github/issues/thiagovazzoler/n8n-nodes-xmpp.svg)](https://github.com/thiagovazzoler/n8n-nodes-xmpp/issues)
[![GitHub stars](https://img.shields.io/github/stars/thiagovazzoler/n8n-nodes-xmpp.svg)](https://github.com/thiagovazzoler/n8n-nodes-xmpp/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Custom [n8n](https://n8n.io) node for integrating with **XMPP servers (Openfire and Spark)**. 
This component allows you **to send and receive messages and files via XMPP**, using **RabbitMQ as a reliable message broker**

---

## ✨ Features
- 🔄 Send messages via RabbitMQ → XMPP (chat automation)
- 📥 Receive incoming messages directly from the XMPP protocol
- 📂 Receive files sent via XMPP, fully parsed and emitted in n8n
- 📎 Support for file transfer with **XEP-0047 (In-Band Bytestreams)** 
- 🛠️ Fully compatible with **Openfire**     
- ⚡ Works as a trigger (listens for incoming events) and as an action (send messages/files)

---

## 📦 Installation

Install the package globally so that n8n can detect it:

```bash
npm install -g n8n-nodes-xmpp
```

## 🚀 Use Cases

 - Build chatbots powered by XMPP + n8n
 - Automate file delivery between systems over XMPP
 - Connect business workflows with Spark/Openfire instant messaging
 - Centralize messaging events in RabbitMQ for scalable processing

## ☕ Support this project

If this component has been useful to you, please consider supporting it with a donation.

PayPal: 👉 [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=EWDNREWUM43U4)