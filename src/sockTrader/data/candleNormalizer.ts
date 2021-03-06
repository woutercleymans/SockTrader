import {IDataFrame} from "data-forge";
import {IAsyncFileReader, readFile} from "data-forge-fs";
import moment from "moment";
import path from "path";
import {Candle} from "../core/types/candle";
import {Pair} from "../core/types/pair";
import {getDecimals} from "./utils";

export interface CandleMetaInfo {
    decimalSeparator?: string;
    name: string;
    symbol: Pair;
}

export type Parser = (candles: IDataFrame) => IDataFrame<number, Candle>;

/**
 * Relative path to the root of the build folder
 */
const BUILD_ROOT = "../../";

/**
 * The CandleNormalizer parses a file containing candles and returns
 * in data for in memory processing
 */
export default class CandleNormalizer {

    private readonly filePath: string;
    private readonly parser: Parser;

    constructor(filePath: string, private candleNormalizerConfig: CandleMetaInfo, parser: Parser) {
        this.parser = parser;
        this.filePath = this.resolveDataFile(filePath);
    }

    /**
     * Parses file depending on the extension/type
     * @param {IAsyncFileReader} fileReader the file to read
     * @param {string} extension the extension
     * @returns {Promise<IDataFrame>} promise
     */
    static async parseFileReader(fileReader: IAsyncFileReader, extension: string): Promise<IDataFrame> {
        if (extension === "json") {
            return fileReader.parseJSON();
        }

        if (extension === "csv") {
            return fileReader.parseCSV({dynamicTyping: true});
        }

        throw new Error("File extension is not valid! Expecting a CSV or JSON file.");
    }

    private resolveDataFile(fileName: string) {
        const DATA_FOLDER = "../src/data";

        const directory = (require.main)
            ? path.dirname(require.main.filename) // Relative to entry file
            : path.resolve(__dirname, BUILD_ROOT); // Relative to current file

        return path.resolve(directory, DATA_FOLDER, fileName);
    }

    /**
     * Determine smallest candle interval of all candles
     * @param df
     */
    private determineCandleInterval(df: IDataFrame): number {
        const [interval] = df.aggregate([] as any, (prev, value) => {
            const [prevInterval, date] = prev;

            let i;
            if (date !== undefined) {
                const minutes = Math.abs(moment.duration(date.diff(value.timestamp)).asMinutes());
                i = (!prevInterval || minutes < prevInterval) ? minutes : prevInterval;
            }

            return [i, value.timestamp];
        });

        return interval;
    }

    private determinePriceDecimals(df: IDataFrame): number {
        const {decimalSeparator: ds} = this.candleNormalizerConfig;
        const agg = df.aggregate(0, (accum, candle) => Math.max(
            accum,
            getDecimals(candle.open, ds),
            getDecimals(candle.high, ds),
            getDecimals(candle.low, ds),
            getDecimals(candle.close, ds),
        ));

        return Math.pow(10, agg);
    }

    private determineVolumeDecimals(df: IDataFrame): number {
        const {decimalSeparator: ds} = this.candleNormalizerConfig;
        return df.aggregate(0, ((accum, candle) =>
            Math.max(accum, getDecimals(candle.volume, ds))),
        );
    }

    private validateColumns(df: IDataFrame) {
        const columnNames = df.getColumnNames();
        const requiredColumns = ["timestamp", "open", "high", "low", "close", "volume"];

        if (columnNames.some(r => requiredColumns.indexOf(r) < 0)) {
            throw new Error(
                "Columns of DataFrame are not valid! " +
                "Expecting: 'open', 'high', 'low', 'close', 'timestamp', 'volume' as valid columns",
            );
        }
    }

    /**
     * Actual parsing of file returning data
     * @returns {Promise<IDataFrame<number>>}
     */
    async normalize(): Promise<any> {
        const segs = this.filePath.split(".");
        const ext = segs[segs.length - 1].toLowerCase();

        const dataFrame: IDataFrame<number, Candle> = this.parser(await CandleNormalizer.parseFileReader(readFile(this.filePath), ext));
        this.validateColumns(dataFrame);

        return {
            candles: dataFrame.orderBy(row => row.timestamp.unix()).toArray(),
            name: this.candleNormalizerConfig.name,
            symbol: this.candleNormalizerConfig.symbol,
            volumeDecimals: this.determineVolumeDecimals(dataFrame),
            priceDecimals: this.determinePriceDecimals(dataFrame),
            candleInterval: this.determineCandleInterval(dataFrame),
        };
    }
}
