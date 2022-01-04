#!/usr/bin/env node

import * as Bluebird from "bluebird";
import * as fs from "fs-extra";
import * as klawSync from "klaw-sync";
import * as _ from "lodash";
import * as md5 from "md5";
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";

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
    const targetColStart = targetColData.start;
    const targetColEnded = targetColData.ended;

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
    const targetRowStart = targetRowData.start;
    const targetRowEnded = targetRowData.ended;

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

    // 创建黑块图
    const blackHBuffer = await sharp({
        create: { width: 2, height: 1, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 1} }
    })
        .toFormat(sharp.format.png)
        .toBuffer();
    const blackVBuffer = await sharp({
        create: { width: 1, height: 2, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 1} }
    })
        .toFormat(sharp.format.png)
        .toBuffer();

    // 创建底图
    const outputImgWidth = targetColStart + 1 + imgWidth - targetColEnded + 1;
    const outputImgHeight = targetRowStart + 1 + imgHeight - targetRowEnded + 1;
    const outputFileSharp = sharp({
        create: { width: outputImgWidth, height: outputImgHeight, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0} }
    });

    // 合成图
    await outputFileSharp.composite([
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