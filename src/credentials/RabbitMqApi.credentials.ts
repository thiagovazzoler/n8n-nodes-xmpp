import {
  ICredentialType,
  INodeProperties
} from 'n8n-workflow';

export class RabbitMqApi implements ICredentialType {
  name = 'rabbitMqApi';
  displayName = 'RabbitMQ';
  properties: INodeProperties[] = [
    {
      displayName: 'Connection Method',
      name: 'method',
      type: 'options',
      default: 'creds',
      options: [
        { name: 'URL', value: 'url' },
        { name: 'Credentials (Host/Port/User/Pass)', value: 'creds' },
      ],
    },

    // --- URL direta ---
    {
      displayName: 'AMQP URL',
      name: 'url',
      type: 'string',
      default: 'amqp://guest:guest@localhost:5672',
      placeholder: 'amqp://user:pass@host:5672/vhost',
      displayOptions: { show: { method: ['url'] } },
      required: true,
    },

    // --- Campos separados ---
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'localhost',
      displayOptions: { show: { method: ['creds'] } },
      required: true,
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 5672,
      displayOptions: { show: { method: ['creds'] } },
      required: true,
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: 'guest',
      displayOptions: { show: { method: ['creds'] } },
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      displayOptions: { show: { method: ['creds'] } },
      required: true,
    },
    {
      displayName: 'VHost',
      name: 'vhost',
      type: 'string',
      default: '/',
      displayOptions: { show: { method: ['creds'] } },
    },
    {
      displayName: 'SSL (amqps)',
      name: 'ssl',
      type: 'boolean',
      default: false,
      displayOptions: { show: { method: ['creds'] } },
    }
  ];
}