# jira-graph-view

Hackathon 2021, [HACK-217: Organization Graph View Based on JIRA Tickets](https://wiki.freewheel.tv/display/EO/HACK-217+Organization+Graph+View+based+on+JIRA+Tickets)

## Demo

See http://spark.dev.fwmrm.net:12306/

# Get started

## Local startup

### Install dependencies

Makes sure you have all the following installed:

- Node 16+
- pnpm

Then run `pnpm install`

### Add a env file

Add `dev.config.json` to the root of your project, which contains the following contains your JIRA(LDAP) credentials.

```json
{
  "username": "__YOUR_LDAP_USERNAME__",
  "password": "__YOUR_LDAP_PASSWORD__"
}
```

> Q: Why do I need to set up LDAP credentials?<br/>
> A: this app need to use it to get access to JIRA API to search for tickets.

## Start

By running `pnpm dev`, a server should be brought up instantly at `localhost:3000`.

# Built with

- React + TypeScript
- [Graphin](https://github.com/antvis/Graphin) ([G6](https://github.com/antvis/G6) React Wrapper)
- [Jotai](https://github.com/pmndrs/jotai)
- [Comlink](https://github.com/GoogleChromeLabs/comlink)
- [DataScript](https://github.com/tonsky/datascript)
- [fastify](https://www.fastify.io/)
- [undici](https://github.com/nodejs/undici)
- Node
- [linkedom](https://github.com/WebReflection/linkedom)
- [Vite](https://github.com/vitejs/vite)
- [PNPM](https://pnpm.io/)
