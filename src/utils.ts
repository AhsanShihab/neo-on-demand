import { createWriteStream, existsSync, mkdirSync, rm, unlink } from "fs";
import { get } from "https";
import { platform, homedir } from "os";
import { join } from "path";
import { extract } from "tar";
import AdmZip = require("adm-zip");

const getNeoOndemandHomeDir = () => {
  return join(homedir(), ".neo-ondemand");
};

const _download = async (url: string, targetFile: string) => {
  const neoOnDemandHomeDir = getNeoOndemandHomeDir();
  const saveLocation = join(neoOnDemandHomeDir, "temp");
  const savePath = join(saveLocation, targetFile);
  if (!existsSync(saveLocation)) mkdirSync(saveLocation, { recursive: true });
  return await new Promise((resolve, reject) => {
    get(url, (response) => {
      const code = response.statusCode ?? 0;
      if (code >= 400) {
        reject(new Error(response.statusMessage));
      } else if (code > 300 && code < 400 && !!response.headers.location) {
        _download(response.headers.location, targetFile).then(() =>
          resolve(null)
        );
      } else {
        const fileWriter = createWriteStream(savePath);
        fileWriter.on("finish", () => {
          fileWriter.close(() => resolve(null));
        });
        fileWriter.on("error", () => {
          unlink(savePath, () =>
            reject(new Error("could not close fileWriter"))
          );
        });
        response.pipe(fileWriter);
      }
    }).on("error", (error) => {
      reject(error);
    });
  });
};

const _extractZipFile = async (zipPath: string, extractTo: string) => {
  var zip = new AdmZip(zipPath);
  return new Promise((resolve, reject) => {
    zip.extractAllToAsync(extractTo, false, false, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
};

const _extractTarFile = async (tarPath: string, extractTo: string) => {
  if (!existsSync(extractTo)) mkdirSync(extractTo, { recursive: true });
  return await extract({ file: tarPath, cwd: extractTo });
};

const _extractDBFiles = async (filename: string, version: string) => {
  const downloadedFilePath = join(getNeoOndemandHomeDir(), "temp", filename);
  const extractedPath = join(getNeoOndemandHomeDir(), "versions");
  if (!existsSync(downloadedFilePath))
    throw new Error("File not found for extracting");

  if (filename.endsWith("zip")) {
    await _extractZipFile(downloadedFilePath, extractedPath);
  } else {
    await _extractTarFile(downloadedFilePath, extractedPath);
  }
  return new Promise((resolve) =>
    rm(downloadedFilePath, () => {
      resolve(null);
    })
  );
};

const downloadNeoCommunityEdition = async (version: string) => {
  let url: string, targetFile: string;
  if (platform() === "win32") {
    url = `https://neo4j.com/artifact.php?name=neo4j-community-${version}-windows.zip`;
    targetFile = `neo4j-community-${version}-windows.zip`;
  } else {
    url = `https://neo4j.com/artifact.php?name=neo4j-community-${version}-unix.tar.gz`;
    targetFile = `neo4j-community-${version}-unix.tar.gz`;
  }
  return _download(url, targetFile).then(() =>
    _extractDBFiles(targetFile, version)
  );
};

export { getNeoOndemandHomeDir, downloadNeoCommunityEdition };
