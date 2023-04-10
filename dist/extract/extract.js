"use strict";
/**
 * @author doubledream
 * @desc 提取指定文件夹下的中文
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAll = void 0;
const _ = require("lodash");
const slash = require("slash2");
const path = require("path");
const colors = require("colors");
const file_1 = require("./file");
const findChineseText_1 = require("./findChineseText");
const getLangData_1 = require("./getLangData");
const utils_1 = require("../utils");
const replace_1 = require("./replace");
const utils_2 = require("../utils");
const CONFIG = utils_2.getProjectConfig();
/**
 * 剔除 kiwiDir 下的文件
 */
function removeLangsFiles(files) {
    const langsDir = path.resolve(process.cwd(), CONFIG.kiwiDir);
    return files.filter(file => {
        const completeFile = path.resolve(process.cwd(), file);
        return !completeFile.includes(langsDir);
    });
}
/**
 * 递归匹配项目中所有的代码的中文
 */
function findAllChineseText(dir) {
    const first = dir.split(',')[0];
    let files = [];
    if (file_1.isDirectory(first)) {
        const dirPath = path.resolve(process.cwd(), dir);
        files = file_1.getSpecifiedFiles(dirPath, CONFIG.ignoreDir, CONFIG.ignoreFile);
    }
    else {
        files = removeLangsFiles(dir.split(','));
    }
    const filterFiles = files.filter(file => {
        return ((file_1.isFile(file) && file.endsWith('.ts')) ||
            file.endsWith('.tsx') ||
            file.endsWith('.vue') ||
            file.endsWith('.js') ||
            file.endsWith('.jsx'));
    });
    const allTexts = filterFiles.reduce((pre, file) => {
        const code = file_1.readFile(file);
        const texts = findChineseText_1.findChineseText(code, file);
        // 调整文案顺序，保证从后面的文案往前替换，避免位置更新导致替换出错
        const sortTexts = _.sortBy(texts, obj => -obj.range.start);
        if (texts.length > 0) {
            console.log(`${utils_1.highlightText(file)} 发现 ${utils_1.highlightText(texts.length)} 处中文文案`);
        }
        return texts.length > 0 ? pre.concat({ file, texts: sortTexts }) : pre;
    }, []);
    return allTexts;
}
/**
 * 处理作为key值的翻译原文
 */
function getTransOriginText(text) {
    // 避免翻译的字符里包含数字或者特殊字符等情况，只过滤出汉字和字母
    const reg = /[a-zA-Z\u4e00-\u9fa5]+/g;
    const findText = text.match(reg) || [];
    const transOriginText = findText ? findText.join('').slice(0, 5) : '中文符号';
    return transOriginText;
}
/**
 * @param currentFilename 文件路径
 * @returns string[]
 */
function getSuggestion(currentFilename) {
    let suggestion = [];
    const suggestPageRegex = /\/pages\/\w+\/([^\/]+)\/([^\/\.]+)/;
    if (currentFilename.includes('/pages/')) {
        suggestion = currentFilename.match(suggestPageRegex);
    }
    if (suggestion) {
        suggestion.shift();
    }
    /** 如果没有匹配到 Key */
    if (!(suggestion && suggestion.length)) {
        const names = slash(currentFilename).split('/');
        const fileName = _.last(names);
        const fileKey = fileName.split('.')[0].replace(new RegExp('-', 'g'), '_');
        const dir = names[names.length - 2].replace(new RegExp('-', 'g'), '_');
        if (dir === fileKey) {
            suggestion = [dir];
        }
        else {
            suggestion = [dir, fileKey];
        }
    }
    return suggestion;
}
/**
 * 统一处理key值，已提取过的文案直接替换，翻译后的key若相同，加上出现次数
 * @param currentFilename 文件路径
 * @param langsPrefix 替换后的前缀
 * @param translateTexts 翻译后的key值
 * @param targetStrs 当前文件提取后的文案
 * @returns any[] 最终可用于替换的key值和文案
 */
function getReplaceableStrs(currentFilename, langsPrefix, translateTexts, targetStrs) {
    const finalLangObj = getLangData_1.getSuggestLangObj();
    const virtualMemory = {};
    const suggestion = getSuggestion(currentFilename);
    const replaceableStrs = targetStrs.reduce((prev, curr, i) => {
        const _text = curr.text;
        let key = utils_1.findMatchKey(finalLangObj, _text);
        if (key) {
            key = key.replace(/-/g, '_');
        }
        if (!virtualMemory[_text]) {
            if (key) {
                virtualMemory[_text] = key;
                return prev.concat({
                    target: curr,
                    key,
                    needWrite: false
                });
            }
            const transText = translateTexts[i] && _.camelCase(translateTexts[i]);
            let transKey = `${suggestion.length ? suggestion.join('.') + '.' : ''}${transText}`;
            transKey = transKey.replace(/-/g, '_');
            if (langsPrefix) {
                transKey = `${langsPrefix}.${transText}`;
            }
            let occurTime = 1;
            // 防止出现前四位相同但是整体文案不同的情况
            while (utils_1.findMatchValue(finalLangObj, transKey) !== _text &&
                _.keys(finalLangObj).includes(`${transKey}${occurTime >= 2 ? occurTime : ''}`)) {
                occurTime++;
            }
            if (occurTime >= 2) {
                transKey = `${transKey}${occurTime}`;
            }
            virtualMemory[_text] = transKey;
            finalLangObj[transKey] = _text;
            return prev.concat({
                target: curr,
                key: transKey,
                needWrite: true
            });
        }
        else {
            return prev.concat({
                target: curr,
                key: virtualMemory[_text],
                needWrite: true
            });
        }
    }, []);
    return replaceableStrs;
}
/**
 * 递归匹配项目中所有的代码的中文
 * @param {dirPath} 文件夹路径
 */
function extractAll({ dirPath, prefix }) {
    const dir = dirPath || './';
    // 去除I18N
    const langsPrefix = prefix ? prefix.replace(/^I18N\./, '') : null;
    // 翻译源配置错误，则终止
    const origin = CONFIG.defaultTranslateKeyApi || 'Pinyin';
    if (!['Pinyin', 'Google', 'Baidu'].includes(CONFIG.defaultTranslateKeyApi)) {
        console.log(`Kiwi 仅支持 ${utils_1.highlightText('Pinyin、Google、Baidu')}，请修改 ${utils_1.highlightText('defaultTranslateKeyApi')} 配置项`);
        return;
    }
    const allTargetStrs = findAllChineseText(dir);
    if (allTargetStrs.length === 0) {
        console.log(utils_1.highlightText('没有发现可替换的文案！'));
        return;
    }
    // 提示翻译源
    if (CONFIG.defaultTranslateKeyApi === 'Pinyin') {
        console.log(`当前使用 ${utils_1.highlightText('Pinyin')} 作为key值的翻译源，若想得到更好的体验，可配置 ${utils_1.highlightText('googleApiKey')} 或 ${utils_1.highlightText('baiduApiKey')}，并切换 ${utils_1.highlightText('defaultTranslateKeyApi')}`);
    }
    else {
        console.log(`当前使用 ${utils_1.highlightText(CONFIG.defaultTranslateKeyApi)} 作为key值的翻译源`);
    }
    console.log('即将截取每个中文文案的前5位翻译生成key值，并替换中...');
    // 对当前文件进行文案key生成和替换
    const generateKeyAndReplace = (item) => __awaiter(this, void 0, void 0, function* () {
        const currentFilename = item.file;
        console.log(`${currentFilename} 替换中...`);
        // 过滤掉模板字符串内的中文，避免替换时出现异常
        const targetStrs = item.texts.reduce((pre, strObj, i) => {
            // 因为文案已经根据位置倒排，所以比较时只需要比较剩下的文案即可
            const afterStrs = item.texts.slice(i + 1);
            if (afterStrs.some(obj => strObj.range.end <= obj.range.end)) {
                return pre;
            }
            return pre.concat(strObj);
        }, []);
        const len = item.texts.length - targetStrs.length;
        if (len > 0) {
            console.log(colors.red(`存在 ${utils_1.highlightText(len)} 处文案无法替换，请避免在模板字符串的变量中嵌套中文`));
        }
        let translateTexts;
        if (origin !== 'Google') {
            // 翻译中文文案，百度和pinyin将文案进行拼接统一翻译
            const delimiter = origin === 'Baidu' ? '\n' : '$';
            const translateOriginTexts = targetStrs.reduce((prev, curr, i) => {
                const transOriginText = getTransOriginText(curr.text);
                if (i === 0) {
                    return transOriginText;
                }
                return `${prev}${delimiter}${transOriginText}`;
            }, []);
            translateTexts = yield utils_1.translateKeyText(translateOriginTexts, origin);
        }
        else {
            // google并发性较好，且未找到有效的分隔符，故仍然逐个文案进行翻译
            const translatePromises = targetStrs.reduce((prev, curr) => {
                const transOriginText = getTransOriginText(curr.text);
                return prev.concat(utils_1.translateText(transOriginText, 'en_US'));
            }, []);
            [...translateTexts] = yield Promise.all(translatePromises);
        }
        if (translateTexts.length === 0) {
            utils_1.failInfo(`未得到翻译结果，${currentFilename}替换失败！`);
            return;
        }
        const replaceableStrs = getReplaceableStrs(currentFilename, langsPrefix, translateTexts, targetStrs);
        yield replaceableStrs
            .reduce((prev, obj) => {
            return prev.then(() => {
                return replace_1.replaceAndUpdate(currentFilename, obj.target, `I18N.${obj.key}`, false, obj.needWrite);
            });
        }, Promise.resolve())
            .then(() => {
            // 添加 import I18N
            if (!replace_1.hasImportI18N(currentFilename)) {
                const code = replace_1.createImportI18N(currentFilename);
                file_1.writeFile(currentFilename, code);
            }
            utils_1.successInfo(`${currentFilename} 替换完成，共替换 ${targetStrs.length} 处文案！`);
        })
            .catch(e => {
            utils_1.failInfo(e.message);
        });
    });
    allTargetStrs
        .reduce((prev, current) => {
        return prev.then(() => {
            return generateKeyAndReplace(current);
        });
    }, Promise.resolve())
        .then(() => {
        utils_1.successInfo('全部替换完成！');
    })
        .catch((e) => {
        utils_1.failInfo(e.message);
    });
}
exports.extractAll = extractAll;
//# sourceMappingURL=extract.js.map