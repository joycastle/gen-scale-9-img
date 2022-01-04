import * as express from "express";
import * as fs from "fs-extra";
import { isArray } from "lodash";
import * as multer from "multer";
import * as childProcess from "child_process";
import "express-zip";

const upload = multer({ dest: 'uploads/' })
const app = express();
const PORT = 3000;
const DEV_MODE = true;

app.use(express.static('public'));

const hashFileNameMap: Map<string, string> = new Map();
const originFileNameMap: Map<string, string> = new Map();

app.post('/upload', upload.array('file'), (req, res) => {
    // 清理 uploads 目录
    const uploadFiles = fs.readdirSync("uploads");
    uploadFiles.forEach((o) => {
        const filePath = `uploads/${o}`;
        const fileStat = fs.statSync(filePath);
        const cdtime = DEV_MODE ? 1000 * 30 : 1000 * 60 * 60 * 24;
        if (Date.now() - fileStat.ctimeMs > cdtime) {
            fs.removeSync(filePath);
            const originFileName = hashFileNameMap.get(o);
            if (originFileName) {
                hashFileNameMap.delete(o);
                originFileNameMap.delete(originFileName);
            }
        }
    });

    if (isArray(req.files)) {
        req.files.forEach((o) => {
            if (o.mimetype !== "image/png") {
                return;
            }
            childProcess.execSync(`gen_slice9_img ${o.path}`);
            hashFileNameMap.set(o.filename, o.originalname);
            originFileNameMap.set(o.originalname, o.filename);
        });
    }
    // console.log(hashFileNameMap);
    // console.log(originFileNameMap);
    res.end();
});

app.get('/download', (req, res) => {
    const fileNamesStr = req.query.fileNames as string;
    if (fileNamesStr.length <= 0) {
        return;
    }
    const fileNames = fileNamesStr.split(",");
    if (fileNames.length <= 0) {
        return;
    }
    if (fileNames.length === 1) {
        res.download(`uploads/${originFileNameMap.get(fileNames[0])}`, fileNames[0]);
        return;
    }
    const zipDatas: {
        path: string,
        name: string,
    }[] = [];
    fileNames.forEach((o) => {
        zipDatas.push({
            path: `uploads/${originFileNameMap.get(o)}`,
            name: o,
        });
    });
    (res as any).zip(zipDatas);
});

app.listen(PORT, () => {
    console.log('Listening at ' + PORT );
});
