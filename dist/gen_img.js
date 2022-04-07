#!/usr/bin/env node
"use strict";
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
const Bluebird = require("bluebird");
const fs = require("fs-extra");
const klawSync = require("klaw-sync");
const _ = require("lodash");
const md5 = require("md5");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const trimImage = require("trim-image");
const inputValue = process.argv[2];
const outputValue = process.argv[3];
if (_.isNil(inputValue) || inputValue === outputValue) {
    console.error("param error");
    process.exit(1);
}
const filterFn = (item) => {
    const basename = path.basename(item.path);
    return basename === "." || basename[0] !== ".";
};
const cpuCount = os.cpus().length;
const stepSize = 1;
function generateImg(inputFilePath, outputFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.time(inputFilePath);
        // 图片 trim
        fs.removeSync(`${inputFilePath}.tmp`);
        yield Bluebird.fromCallback((callback) => trimImage(inputFilePath, `${inputFilePath}.tmp`, { top: true, right: true, bottom: true, left: true }, (err) => {
            if (!err) {
                callback(null);
            }
            else {
                callback(new Error("trim image error"));
            }
        }));
        yield Bluebird.delay(100);
        fs.moveSync(`${inputFilePath}.tmp`, inputFilePath, { overwrite: true });
        // 计算宽度高度
        const inputFileSharp = sharp(inputFilePath);
        const metadata = yield inputFileSharp.metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;
        console.log("imgWidth -> ", imgWidth);
        console.log("imgHeight -> ", imgHeight);
        // 列处理
        const chunkWidth = Math.ceil(imgWidth / cpuCount);
        const widthSplitCount = Math.ceil(imgWidth / chunkWidth);
        let colHashs = [];
        yield Bluebird.map(_.range(0, widthSplitCount), (i) => __awaiter(this, void 0, void 0, function* () {
            const startWidth = chunkWidth * i;
            const endedWidth = _.min([startWidth + chunkWidth, imgWidth]);
            for (let j = startWidth; j < endedWidth; j += stepSize) {
                const buffer = yield inputFileSharp.extract({ left: j, top: 0, width: 1, height: imgHeight })
                    .raw()
                    .toBuffer();
                const hash = md5(buffer);
                colHashs[j] = hash;
            }
        }));
        colHashs = colHashs.filter((o) => o && o.length >= 0);
        const colDatas = [];
        colHashs.forEach((o, i) => {
            const idx = i * stepSize;
            if (colDatas.length <= 0 || _.last(colDatas).hash !== o) {
                colDatas.push({
                    hash: o,
                    start: idx,
                    ended: idx,
                });
            }
            else {
                _.last(colDatas).ended = idx;
            }
        });
        // console.log(colDatas);
        const targetColData = _.maxBy(colDatas, (o) => o.ended - o.start);
        let targetColStart = targetColData.start;
        let targetColEnded = targetColData.ended;
        if (targetColEnded === targetColStart) {
            const midCol = Math.floor(imgWidth / 2);
            targetColStart = midCol - 1;
            targetColEnded = midCol;
        }
        // 行处理
        const chunkHeight = Math.ceil(imgHeight / cpuCount);
        const heightSplitCount = Math.ceil(imgHeight / chunkHeight);
        let rowHashs = [];
        yield Bluebird.map(_.range(0, heightSplitCount), (i) => __awaiter(this, void 0, void 0, function* () {
            const startHeight = chunkHeight * i;
            const endedHeight = _.min([startHeight + chunkHeight, imgHeight]);
            for (let j = startHeight; j < endedHeight; j += stepSize) {
                const buffer = yield inputFileSharp.extract({ left: 0, top: j, width: imgWidth, height: 1 })
                    .raw()
                    .toBuffer();
                const hash = md5(buffer);
                rowHashs[j] = hash;
            }
        }));
        rowHashs = rowHashs.filter((o) => o && o.length >= 0);
        const rowDatas = [];
        rowHashs.forEach((o, i) => {
            const idx = i * stepSize;
            if (rowDatas.length <= 0 || _.last(rowDatas).hash !== o) {
                rowDatas.push({
                    hash: o,
                    start: idx,
                    ended: idx,
                });
            }
            else {
                _.last(rowDatas).ended = idx;
            }
        });
        // console.log(rowDatas);
        const targetRowData = _.maxBy(rowDatas, (o) => o.ended - o.start);
        let targetRowStart = targetRowData.start;
        let targetRowEnded = targetRowData.ended;
        if (targetRowEnded === targetRowStart) {
            const midRow = Math.floor(imgHeight / 2);
            targetRowStart = midRow - 1;
            targetRowEnded = midRow;
        }
        // 截9宫图
        const slice1Buffer = yield inputFileSharp.extract({ left: 0, top: 0, width: targetColStart + 1, height: targetRowStart + 1 })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice2Buffer = yield inputFileSharp.extract({ left: targetColEnded, top: 0, width: imgWidth - targetColEnded, height: targetRowStart + 1 })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice3Buffer = yield inputFileSharp.extract({ left: 0, top: targetRowEnded, width: targetColStart + 1, height: imgHeight - targetRowEnded })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice4Buffer = yield inputFileSharp.extract({ left: targetColEnded, top: targetRowEnded, width: imgWidth - targetColEnded, height: imgHeight - targetRowEnded })
            .toFormat(sharp.format.png)
            .toBuffer();
        // 创建黑块图
        const blackHBuffer = yield sharp({
            create: { width: 2, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
            .toFormat(sharp.format.png)
            .toBuffer();
        const blackVBuffer = yield sharp({
            create: { width: 1, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        })
            .toFormat(sharp.format.png)
            .toBuffer();
        // 创建底图
        const outputImgWidth = targetColStart + 1 + imgWidth - targetColEnded + 1;
        const outputImgHeight = targetRowStart + 1 + imgHeight - targetRowEnded + 1;
        const outputFileSharp = sharp({
            create: { width: outputImgWidth, height: outputImgHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        });
        // 合成图
        yield outputFileSharp.composite([
            {
                input: blackHBuffer,
                left: targetColStart + 1,
                top: 0,
            },
            {
                input: blackVBuffer,
                left: 0,
                top: targetRowStart + 1,
            },
            {
                input: slice1Buffer,
                left: 1,
                top: 1,
            },
            {
                input: slice2Buffer,
                left: targetColStart + 2,
                top: 1,
            },
            {
                input: slice3Buffer,
                left: 1,
                top: targetRowStart + 2,
            },
            {
                input: slice4Buffer,
                left: targetColStart + 2,
                top: targetRowStart + 2,
            },
        ])
            .toFormat(sharp.format.png)
            .toFile(outputFilePath);
        console.timeEnd(inputFilePath);
    });
}
(function func() {
    return __awaiter(this, void 0, void 0, function* () {
        const inputValueStat = fs.statSync(inputValue);
        if (inputValueStat.isFile()) {
            const inputFilePath = inputValue;
            const outputFilePath = outputValue || inputValue;
            yield generateImg(inputFilePath, outputFilePath);
        }
        else {
            if (!_.isNil(outputValue)) {
                if (!fs.existsSync(outputValue)) {
                    fs.mkdirSync(outputValue);
                }
            }
            const files = klawSync(inputValue, { nodir: true, filter: filterFn });
            for (const file of files) {
                const inputFilePath = file.path;
                let outputFilePath = file.path;
                if (!_.isNil(outputValue)) {
                    outputFilePath = `${outputValue}/${path.basename(file.path)}`;
                }
                yield generateImg(inputFilePath, outputFilePath);
            }
        }
    });
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
