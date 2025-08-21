declare module '@xmpp/xml' {
  function xml(name: string, attrs?: Record<string, any>, ...children: any[]): any;
  export default xml;
}
