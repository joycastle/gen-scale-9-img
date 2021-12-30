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
const inputValue = process.argv[2];
if (_.isNil(inputValue)) {
    console.error("input value is null");
    process.exit(1);
}
const filterFn = (item) => {
    const basename = path.basename(item.path);
    return basename === "." || basename[0] !== ".";
};
const cpuCount = os.cpus().length;
const stepSize = 5;
function generateImg(inputFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.time(inputFilePath);
        // 计算宽度高度
        const inputFileSharp = sharp(inputFilePath);
        const metadata = yield inputFileSharp.metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;
        // console.log("imgWidth -> ", imgWidth);
        // console.log("imgHeight -> ", imgHeight);
        // 列处理
        const chunkWidth = Math.ceil(imgWidth / cpuCount);
        const widthSplitCount = Math.ceil(imgWidth / chunkWidth);
        let cols = [];
        yield Bluebird.map(_.range(0, widthSplitCount), (i) => __awaiter(this, void 0, void 0, function* () {
            const startWidth = chunkWidth * i;
            const endedWidth = _.min([startWidth + chunkWidth - 1, imgWidth - 1]);
            for (let j = startWidth; j < endedWidth; j += stepSize) {
                const buffer = yield inputFileSharp.extract({ left: j, top: 0, width: 1, height: imgHeight })
                    .raw()
                    .toBuffer();
                const hash = md5(buffer);
                cols[j] = hash;
            }
        }));
        cols = cols.filter((o) => o && o.length >= 0);
        const colMap = new Map();
        let targetColHash = null;
        let targetColStart = 0;
        let targetColEnded = 0;
        cols.forEach((o, i) => {
            const idx = i * stepSize;
            if (!colMap.has(o)) {
                colMap.set(o, {
                    start: idx,
                    ended: idx,
                });
            }
            const data = colMap.get(o);
            data.ended = idx;
            if (_.isNil(targetColHash) || (data.ended - data.start > targetColEnded - targetColStart)) {
                targetColHash = o;
                targetColStart = data.start;
                targetColEnded = data.ended;
            }
        });
        // console.log(targetColStart, targetColEnded);
        // 行处理
        const chunkHeight = Math.ceil(imgHeight / cpuCount);
        const heightSplitCount = Math.ceil(imgHeight / chunkHeight);
        let rows = [];
        yield Bluebird.map(_.range(0, heightSplitCount), (i) => __awaiter(this, void 0, void 0, function* () {
            const startHeight = chunkHeight * i;
            const endedHeight = _.min([startHeight + chunkHeight - 1, imgHeight - 1]);
            for (let j = startHeight; j < endedHeight; j += stepSize) {
                const buffer = yield inputFileSharp.extract({ left: 0, top: j, width: imgWidth, height: 1 })
                    .raw()
                    .toBuffer();
                const hash = md5(buffer);
                rows[j] = hash;
            }
        }));
        rows = rows.filter((o) => o && o.length >= 0);
        const rowMap = new Map();
        let targetRowHash = null;
        let targetRowStart = 0;
        let targetRowEnded = 0;
        rows.forEach((o, i) => {
            const idx = i * stepSize;
            if (!rowMap.has(o)) {
                rowMap.set(o, {
                    start: idx,
                    ended: idx,
                });
            }
            const data = rowMap.get(o);
            data.ended = idx;
            if (_.isNil(targetRowHash) || (data.ended - data.start > targetRowEnded - targetRowStart)) {
                targetRowHash = o;
                targetRowStart = data.start;
                targetRowEnded = data.ended;
            }
        });
        // console.log(targetRowStart, targetRowEnded);
        // 截9宫图
        const slice1Buffer = yield inputFileSharp.extract({ left: 0, top: 0, width: targetColStart + 1, height: targetRowStart + 1 })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice2Buffer = yield inputFileSharp.extract({ left: targetColEnded - 1, top: 0, width: imgWidth - targetColEnded, height: targetRowStart + 1 })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice3Buffer = yield inputFileSharp.extract({ left: 0, top: targetRowEnded - 1, width: targetColStart + 1, height: imgHeight - targetRowEnded })
            .toFormat(sharp.format.png)
            .toBuffer();
        const slice4Buffer = yield inputFileSharp.extract({ left: targetColEnded - 1, top: targetRowEnded - 1, width: imgWidth - targetColEnded, height: imgHeight - targetRowEnded })
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
            .toFile(inputFilePath);
        console.timeEnd(inputFilePath);
    });
}
(function func() {
    return __awaiter(this, void 0, void 0, function* () {
        const inputValueStat = fs.statSync(inputValue);
        if (inputValueStat.isFile()) {
            yield generateImg(inputValue);
        }
        else {
            const inputValues = klawSync(inputValue, { nodir: true, filter: filterFn });
            for (const inputValue of inputValues) {
                yield generateImg(inputValue.path);
            }
        }
    });
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
