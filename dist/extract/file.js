"use strict";
/**
 * @author doubledream
 * @desc 文件处理方法
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDirectory = exports.isFile = exports.writeFile = exports.readFile = exports.getSpecifiedFiles = void 0;
const path = require("path");
const fs = require("fs");
/**
 * 获取文件夹下符合要求的所有文件
 * @function getSpecifiedFiles
 * @param  {string} dir 路径
 * @param {ignoreDirectory} 忽略文件夹 {ignoreFile} 忽略的文件
 */
function getSpecifiedFiles(dir, ignoreDirectory = [], ignoreFile = []) {
    const standardIgnoreDirectory = Array.isArray(ignoreDirectory) ? ignoreDirectory : [ignoreDirectory];
    const standardIgnoreFile = Array.isArray(ignoreFile) ? ignoreFile : [ignoreFile];
    return fs.readdirSync(dir).reduce((files, file) => {
        const name = path.join(dir, file);
        const isDirectory = fs.statSync(name).isDirectory();
        const isFile = fs.statSync(name).isFile();
        if (isDirectory) {
            return files.concat(getSpecifiedFiles(name, standardIgnoreDirectory, standardIgnoreFile));
        }
        const isIncludeDirectory = !(standardIgnoreDirectory || []).length ||
            !(standardIgnoreDirectory || []).some(ignoreDir => {
                return path
                    .dirname(name)
                    .split(path.sep)
                    .join('/')
                    .includes(ignoreDir);
            });
        const isIncludeFile = !(standardIgnoreFile || []).length ||
            !(standardIgnoreFile || []).some(filename => name
                .split(path.sep)
                .join('/')
                .includes(filename));
        if (isFile && isIncludeDirectory && isIncludeFile) {
            return files.concat(name);
        }
        return files;
    }, []);
}
exports.getSpecifiedFiles = getSpecifiedFiles;
/**
 * 读取文件
 * @param fileName
 */
function readFile(fileName) {
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf-8');
    }
}
exports.readFile = readFile;
/**
 * 读取文件
 * @param fileName
 */
function writeFile(filePath, file) {
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file);
    }
}
exports.writeFile = writeFile;
/**
 * 判断是文件
 * @param path
 */
function isFile(path) {
    return fs.statSync(path).isFile();
}
exports.isFile = isFile;
/**
 * 判断是文件夹
 * @param path
 */
function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}
exports.isDirectory = isDirectory;
//# sourceMappingURL=file.js.map