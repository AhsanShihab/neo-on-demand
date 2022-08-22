# neo-on-demand
![version](https://img.shields.io/badge/version-1.0.0-blue) ![node](https://img.shields.io/badge/node-%3E%3D16.7.0-brightgreen)

neo-on-demand creates neo4j (community edition) database instance from nodejs code. The database can be persistent or temporary, making it ideal to use for test setup. You can create multiple instances of neo4j database and run them in parallel. This is useful for parallel test running.

```shell
npm install --save-dev neo-on-demand
```

## Neo4J
This package runs neo4j bin file natively on your machine. To run the bin file, you need to have Java installed. If you don't have java installed, install the version best suited for the neo4j version you intend to run. You can find the requirements in the [neo4j doc](https://neo4j.com/docs/operations-manual/current/installation/requirements/#deployment-requirements-software)

## Supported neo4j version

Tested with version 3.5.0 and 4.x.x

## Supported OS
Unix and Windows

## Example
```javascript
import NeoDB from 'neo-on-demand';

const main = async () => {
  const db = new NeoDB()
  await db.start()
  const httpUrl = db.getHttpURL()
  const boltUrl = db.getBoltURL()
  // do your stuff

  // then close the database
  db.stop()
}
```

You can pass the http and bolt port number and run multiple databases.

```javascript
import NeoDB from 'neo-on-demand';

const main = async () => {
  const db1 = new NeoDB(7474, 7687)
  const db2 = new NeoDB(7475, 7688)
  ...
}
```

You can pass an `option` object as the third parameter which can have the following optional properties.

* `version` (:string) -  specify the version number of neo4j server
* `persistData` (:boolean) - If `true`, data will be kept after closing the database. Default value is `false`


## Troubleshoot
If the code fails to start the server, first make sure the server can start natively on your machine. To check that, 
* Go to `<your user home directory>/.neo-on-demand/versions/neo4j-community-<version number>`
* open a terminal
* run `./bin/neo console --verbose` (or `bin\neo.bat console --verbose` on windows)
* If the server is failing to run, check the log to see what is causing the issue.

If the server properly runs, please create an issue with all the details.
