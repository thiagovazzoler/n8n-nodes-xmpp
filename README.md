# n8n-nodes-xmpp

![Banner](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-xmpp.svg)](https://www.npmjs.com/package/n8n-nodes-xmpp)
[![npm downloads](https://img.shields.io/npm/dt/n8n-nodes-xmpp.svg)](https://www.npmjs.com/package/n8n-nodes-xmpp)
[![GitHub issues](https://img.shields.io/github/issues/thiagovazzoler/n8n-nodes-xmpp.svg)](https://github.com/thiagovazzoler/n8n-nodes-xmpp/issues)
[![GitHub stars](https://img.shields.io/github/stars/thiagovazzoler/n8n-nodes-xmpp.svg)](https://github.com/thiagovazzoler/n8n-nodes-xmpp/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Custom [n8n](https://n8n.io) node for integrating with **XMPP servers (Openfire and Spark)**.  
This node allows you to **send and receive messages via XMPP**, making it easier to automate workflows using instant messaging.

---

## ✨ Features
- 🔄 Send XMPP messages to a given JID  
- 📥 Listen for incoming messages (webhook-like behavior)  
- 📎 Support for file transfer with **XEP-0047 (In-Band Bytestreams)** 
- 🛠️ Fully compatible with **Openfire** 

---

## 📦 Installation

Install the package globally so that n8n can detect it:

```bash
npm install -g n8n-nodes-xmpp
