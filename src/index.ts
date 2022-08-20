import { getNeoOndemandHomeDir, downloadNeoCommunityEdition } from "./utils";
import { join, resolve } from "path";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFile,
  writeFile,
  rmSync,
} from "fs";
import { platform } from "os";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

class NeoDB {
  httpPort: number;
  version: string;
  boltPort: number;
  persistData: boolean;
  dbProcess: ChildProcessWithoutNullStreams | undefined;

  constructor(
    httpPort?: number,
    version?: string,
    boltPort?: number,
    persistData: boolean = false
  ) {
    this.httpPort = httpPort || 7474;
    this.version = version || "4.4.10";
    this.boltPort = boltPort || 7687;
    this.persistData = persistData;
  }

  private getServerFilesLocation = () =>
    join(
      getNeoOndemandHomeDir(),
      "versions",
      `neo4j-community-${this.version}`
    );
  private getOriginalConfFileLocation = () =>
    this.getServerFilesLocation() + "/conf/neo4j.conf";

  private getInstanceDataLocation = () => {
    const dir = join(
      getNeoOndemandHomeDir(),
      "instance-data",
      String(this.httpPort)
    );
    const dataDir = join(dir, "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(dataDir)) mkdirSync(join(dir, "data"));
    return dir;
  };

  private getCustomConfFileLocation = () =>
    join(this.getInstanceDataLocation(), "neo4j.conf");

  private getServerBinFile = () =>
    join(
      this.getServerFilesLocation(),
      "bin",
      platform() === "win32" ? "neo4j.bat" : "neo4j"
    );

  private setProperties = async () => {
    const customConfig = {
      "dbms.connector.https.enabled": false,
      "dbms.security.auth_enabled": false,
      "dbms.ssl.policy.bolt.client_auth": "NONE",
      "dbms.connector.bolt.listen_address": `:${this.boltPort}`,
      "dbms.connector.http.listen_address": `:${this.httpPort}`,
      "dbms.directories.data": join(this.getInstanceDataLocation(), "data"),
    };

    return new Promise((resolve, reject) => {
      readFile(this.getOriginalConfFileLocation(), "utf8", (err, data) => {
        if (err) reject(err);
        const keysToUpdate = Object.keys(customConfig);
        const updatedLines = data
          .split("\n")
          .filter((line) => keysToUpdate.some((k) => !line.includes(k)));
        keysToUpdate.forEach((k) =>
          // @ts-ignore
          updatedLines.push(`${k}=${customConfig[k]}\n`)
        );
        const newData = updatedLines.join("\n");
        writeFile(this.getCustomConfFileLocation(), newData, "utf8", (err) => {
          if (err) reject(err);
          else resolve(null);
        });
      });
    });
  };

  private cleanUp = () => {
    rmSync(this.getInstanceDataLocation(), { recursive: true, force: true });
  };

  start = async () => {
    const binFile = this.getServerBinFile();
    if (!existsSync(binFile)) {
      await downloadNeoCommunityEdition(this.version);
      console.log("download complete");
    }
    await this.setProperties();
    chmodSync(binFile, "755");
    this.dbProcess = spawn(binFile, ["console"], {
      env: { ...process.env, NEO4J_CONF: this.getInstanceDataLocation() },
    });

    this.dbProcess.on("close", () => {
      if (!this.persistData) this.cleanUp();
    });
    process.on("exit", () => {
      this.stop();
    });
    const dbProcess = this.dbProcess;
    return new Promise((resolve) => {
      dbProcess.stdout.on("data", (message) => {
        message = message.toString();
        if (message.indexOf("Started.") !== -1) {
          resolve(null);
        }
      });
    });
  };

  stop = () => {
    if (!this.persistData) this.cleanUp();
    this.dbProcess?.kill();
  };

  getBoltURL = () => `bolt://localhost:${this.boltPort}`;
  getHttpURL = () => `http://localhost:${this.httpPort}`;
}

export default NeoDB;
