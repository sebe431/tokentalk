# Tokentalk

Tokentalk is an anonymous textboard where certain boards require owning ether/erc20 tokens to view/post.
It's made for node.js and relies on mongodb as a database.

## Installation

### Requirements

* nodejs
* npm
* mongodb

```bash
npm install
```

## Usage

There are a few files that need to be created, they hold sensitive data. All go in the root folder.

credsDB.json
```bash
{
    "uri":"mongodb address + database name, example: mongodb://127.0.0.1/test",
    "user":"server username",
    "pass":"user password"
}
```

credsEthAdmins.json
```bash
{
    "lowercased ethereum address of admin 1":true,
    "lowercased ethereum address of admin 2, and so forth":true
}
```

credsEthNode.json
```bash
{
    "address":"ethereum node http provider address"
}
```

```bash
node main.js
```

## Configuring boards

this will change in the future, but right now boards.js contains board configurations, it should be self explanatory with plenty of examples

## License
[MIT](https://choosealicense.com/licenses/mit/)