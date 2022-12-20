#!/usr/bin/env node

import * as Bluebird from "bluebird";
import * as fs from "fs-extra";
import * as klawSync from "klaw-sync";
import * as _ from "lodash";
import * as md5 from "md5";
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";
import * as trimImage from "trim-image";

const inputValue = process.argv[2];
const outputValue = process.argv[3];

if (_.isNil(inputValue) || inputValue === outputValue) {
    console.error("param error");
    process.exit(1);
}

const filterFn = (item: klawSync.Item) => {
    const basename = path.basename(item.path);
    return basename === "." || basename[0] !== ".";
};

const cpuCount = os.cpus().length;
const stepSize = 1;

async function generateImg(inputFilePath: string, outputFilePath: string) {
    console.time(inputFilePath);

    // 图片 trim
    fs.removeSync(`${inputFilePath}.png`);
    fs.removeSync(`${inputFilePath}.tmp`);
    fs.moveSync(inputFilePath, `${inputFilePath}.png`, {overwrite: true});
    await Bluebird.fromCallback((callback) => trimImage(`${inputFilePath}.png`, `${inputFilePath}.tmp`, {top: true, right: true, bottom: true, left: true}, (err) => {
        if (!err) {
            callback(null);
        } else {
            callback(new Error(err));
        }
    }));
    await Bluebird.delay(100);
    fs.removeSync(`${inputFilePath}.png`);
    fs.moveSync(`${inputFilePath}.tmp`, inputFilePath, {overwrite: true});

    // 计算宽度高度
    const inputFileSharp = sharp(inputFilePath);
    const metadata = await inputFileSharp.metadata()
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    console.log("imgWidth -> ", imgWidth);
    console.log("imgHeight -> ", imgHeight);

    // 列处理
    const chunkWidth = Math.ceil(imgWidth / cpuCount);
    const widthSplitCount = Math.ceil(imgWidth / chunkWidth);
    let colHashs: string[] = [];
    await Bluebird.map(_.range(0, widthSplitCount), async(i) => {
        const startWidth = chunkWidth * i;
        const endedWidth = _.min([startWidth + chunkWidth, imgWidth]);
        for (let j = startWidth; j < endedWidth; j += stepSize) {
            const buffer = await inputFileSharp.extract({ left: j, top: 0, width: 1, height: imgHeight })
                .raw()
                .toBuffer();
            const hash = md5(buffer);
            colHashs[j] = hash;
        }
    });
    colHashs = colHashs.filter((o) => o && o.length >= 0)
    const colDatas: {hash: string, start: number, ended: number}[] = [];
    colHashs.forEach((o, i) => {
        const idx = i * stepSize;
        if (colDatas.length <= 0 || _.last(colDatas).hash !== o) {
            colDatas.push({
                hash: o,
                start: idx,
                ended: idx,
            });
        } else {
            _.last(colDatas).ended = idx;
        }
    });
    // console.log(colDatas);
    const targetColData = _.maxBy(colDatas, (o) => o.ended - o.start);
    let targetColStart = targetColData.start;
    let targetColEnded = targetColData.ended;
    if (targetColEnded === targetColStart) {
        const midCol = Math.floor(imgWidth / 2)
        targetColStart = midCol - 1;
        targetColEnded = midCol;
    }

    // 行处理
    const chunkHeight = Math.ceil(imgHeight / cpuCount);
    const heightSplitCount = Math.ceil(imgHeight / chunkHeight);
    let rowHashs: string[] = [];
    await Bluebird.map(_.range(0, heightSplitCount), async(i) => {
        const startHeight = chunkHeight * i;
        const endedHeight = _.min([startHeight + chunkHeight, imgHeight]);
        for (let j = startHeight; j < endedHeight; j += stepSize) {
            const buffer = await inputFileSharp.extract({ left: 0, top: j, width: imgWidth, height: 1 })
                .raw()
                .toBuffer();
            const hash = md5(buffer);
            rowHashs[j] = hash;
        }
    });
    rowHashs = rowHashs.filter((o) => o && o.length >= 0)
    const rowDatas: {hash: string, start: number, ended: number}[] = [];
    rowHashs.forEach((o, i) => {
        const idx = i * stepSize;
        if (rowDatas.length <= 0 || _.last(rowDatas).hash !== o) {
            rowDatas.push({
                hash: o,
                start: idx,
                ended: idx,
            });
        } else {
            _.last(rowDatas).ended = idx;
        }
    });
    // console.log(rowDatas);
    const targetRowData = _.maxBy(rowDatas, (o) => o.ended - o.start);
    let targetRowStart = targetRowData.start;
    let targetRowEnded = targetRowData.ended;
    if (targetRowEnded === targetRowStart) {
        const midRow = Math.floor(imgHeight / 2)
        targetRowStart = midRow - 1;
        targetRowEnded = midRow;
    }

    // 截9宫图
    const slice1Buffer = await inputFileSharp.extract({ left: 0, top: 0, width: targetColStart + 1, height: targetRowStart + 1 })
        .toFormat(sharp.format.png)
        .toBuffer();
    const slice2Buffer = await inputFileSharp.extract({ left: targetColEnded, top: 0, width: imgWidth - targetColEnded, height: targetRowStart + 1 })
        .toFormat(sharp.format.png)
        .toBuffer();
    const slice3Buffer = await inputFileSharp.extract({ left: 0, top: targetRowEnded, width: targetColStart + 1, height: imgHeight - targetRowEnded })
        .toFormat(sharp.format.png)
        .toBuffer();
    const slice4Buffer = await inputFileSharp.extract({ left: targetColEnded, top: targetRowEnded, width: imgWidth - targetColEnded, height: imgHeight - targetRowEnded })
        .toFormat(sharp.format.png)
        .toBuffer();

    // 创建底图
    const outputImgWidth = targetColStart + 1 + imgWidth - targetColEnded;
    const outputImgHeight = targetRowStart + 1 + imgHeight - targetRowEnded;
    const outputFileSharp = sharp({
        create: { width: outputImgWidth, height: outputImgHeight, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0} }
    });

    // 合成图
    await outputFileSharp.composite([
        {
            input: slice1Buffer,
            left: 0,
            top: 0,
        },
        {
            input: slice2Buffer,
            left: targetColStart + 1,
            top: 0,
        },
        {
            input: slice3Buffer,
            left: 0,
            top: targetRowStart + 1,
        },
        {
            input: slice4Buffer,
            left: targetColStart + 1,
            top: targetRowStart + 1,
        },
    ])
        .toFormat(sharp.format.png)
        .toFile(outputFilePath);

    console.timeEnd(inputFilePath);
}

(async function func() {
    const inputValueStat = fs.statSync(inputValue);
    if (inputValueStat.isFile()) {
        const inputFilePath = inputValue;
        const outputFilePath = outputValue || inputValue;
        await generateImg(inputFilePath, outputFilePath);
    } else {
        if (!_.isNil(outputValue)) {
            if (!fs.existsSync(outputValue)) {
                fs.mkdirSync(outputValue);
            }
        }
        const files = klawSync(inputValue, {nodir: true, filter: filterFn});
        for (const file of files) {
            const inputFilePath = file.path;
            let outputFilePath = file.path;
            if (!_.isNil(outputValue)) {
                outputFilePath = `${outputValue}/${path.basename(file.path)}`;
            }
            await generateImg(inputFilePath, outputFilePath);
        }
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
