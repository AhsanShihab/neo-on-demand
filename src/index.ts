import { getNeoOndemandHomeDir, downloadNeoCommunityEdition } from "./utils";
import { join } from "path";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFile,
  writeFile,
  rmSync,
  cpSync,
} from "fs";
import { platform } from "os";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

class NeoDB {
  httpPort: number;
  boltPort: number;
  version: string;
  persistData: boolean;
  dbProcess: ChildProcessWithoutNullStreams | undefined;

  constructor(
    httpPort: number = 7474,
    boltPort: number = 7687,
    option: {
      version?: string;
      persistData?: boolean;
    } = {}
  ) {
    this.httpPort = httpPort;
    this.boltPort = boltPort;
    this.version = option.version || "4.4.10";
    this.persistData = option.persistData || false;
  }

  private getServerFilesLocation = () =>
    join(
      getNeoOndemandHomeDir(),
      "versions",
      `neo4j-community-${this.version}`
    );

  private getInstanceDataLocation = () => {
    const dir = join(
      getNeoOndemandHomeDir(),
      "instance-data",
      String(this.httpPort)
    );
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  };

  private getCustomConfFileLocation = () =>
    join(this.getInstanceDataLocation(), "conf", "neo4j.conf");

  private getServerBinFile = () =>
    join(
      this.getInstanceDataLocation(),
      "bin",
      platform() === "win32" ? "neo4j.bat" : "neo4j"
    );

  private setProperties = async () => {
    const customConfig: { [key: string]: string | number | boolean } = {
      "dbms.default_database": `neo-ondemand-${this.httpPort}`,
      "dbms.connector.https.enabled": false,
      "dbms.security.auth_enabled": false,
      "dbms.connector.bolt.listen_address": `:${this.boltPort}`,
      "dbms.connector.http.listen_address": `:${this.httpPort}`,
      "dbms.directories.data": join(this.getInstanceDataLocation(), "data"),
    };

    return new Promise((resolve, reject) => {
      readFile(this.getCustomConfFileLocation(), "utf8", (err, data) => {
        if (err) reject(err);
        const keysToUpdate = Object.keys(customConfig);
        const updatedLines = data
          .split("\n")
          .filter((line) => keysToUpdate.some((k) => !line.includes(k)));
        keysToUpdate.forEach((k) =>
          updatedLines.push(`${k}=${customConfig[k]}`)
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
    const baseFiles = this.getServerFilesLocation();
    if (!existsSync(baseFiles)) {
      await downloadNeoCommunityEdition(this.version);
      console.log("download complete");
    }
    cpSync(baseFiles, this.getInstanceDataLocation(), { recursive: true });
    await this.setProperties();
    const binFile = this.getServerBinFile();
    chmodSync(binFile, "755");
    this.dbProcess = spawn(binFile, ["console"], {
      env: {
        ...process.env,
        NEO4J_CONF: join(this.getInstanceDataLocation(), "conf"),
      },
    });

    this.dbProcess.on("close", () => {
      if (!this.persistData) this.cleanUp();
    });
    process.on("exit", () => {
      this.stop();
    });
    const dbProcess = this.dbProcess;
    return new Promise((resolve, reject) => {
      dbProcess.stdout.on("data", (message) => {
        message = message.toString();
        if (message.indexOf("Started.") !== -1) {
          resolve(null);
        }
      });
      dbProcess.stderr.on("data", (message) => {
        message = message.toString();
        console.error(message);
      });
      dbProcess.on("exit", () => {
        reject(new Error(`${this.version} server could not be started`));
      });
    });
  };

  stop = async () => {
    if (!this.persistData) this.cleanUp();
    this.dbProcess?.kill();
    return new Promise((resolve) => {
      if(!this.dbProcess) resolve(null);
      this.dbProcess?.on("exit", () => resolve(null));
    });
  };

  getBoltURL = () => `bolt://localhost:${this.boltPort}`;
  getHttpURL = () => `http://localhost:${this.httpPort}`;
}

export = NeoDB;
