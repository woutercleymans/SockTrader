import {Order, OrderStatus} from "../../../sockTrader/core/types/order";
import {orderLogger} from "../../../sockTrader/core/loggerFactory";
import TimeTracker from "../../../sockTrader/core/plugins/order/timeTracker";
import {
    FX_FILLED_BUY_ORDER,
    FX_FILLED_SELL_ORDER,
    FX_NEW_BUY_ORDER,
    FX_NEW_SELL_ORDER,
    FX_REPLACED_BUY_ORDER,
} from "../../../__fixtures__/order";

jest.mock("../../../sockTrader/core/loggerFactory");

let timeTracker = new TimeTracker();

beforeEach(() => {
    jest.clearAllMocks();
    timeTracker = new TimeTracker();
    jest.spyOn(Date, "now").mockImplementation(() => 1479427200000);
});

describe("onReport", () => {
    it("Should not log when new order has been created", () => {
        timeTracker.onReport(FX_NEW_BUY_ORDER);
        expect(orderLogger.info).toHaveBeenCalledTimes(0);
    });

    it("Should log when an order has been partially filled", () => {
        timeTracker.onReport({id: "1", status: OrderStatus.PARTIALLY_FILLED} as Order);
        expect(orderLogger.info).toHaveBeenNthCalledWith(1, "Open time: 0 partiallyFilled");
    });

    it("Should log when an order has been filled", () => {
        timeTracker.onReport(FX_NEW_BUY_ORDER);
        jest.spyOn(Date, "now").mockImplementation(() => 1479427200000 + (60 * 5) * 1000);

        timeTracker.onReport(FX_FILLED_BUY_ORDER);
        expect(orderLogger.info).toHaveBeenNthCalledWith(1, "Open time: 300 filled");
    });

    test.each([
        [OrderStatus.EXPIRED],
        [OrderStatus.SUSPENDED],
        [OrderStatus.CANCELED],
        [OrderStatus.FILLED],
    ])("Should cleanup completed orders", (status: OrderStatus) => {
        timeTracker.onReport(FX_NEW_BUY_ORDER);
        expect(timeTracker["orders"]).toEqual({"NEW_BUY_ORDER_1": 1479427200});

        timeTracker.onReport({...FX_NEW_BUY_ORDER, status});
        expect(timeTracker["orders"]).toEqual({});
    });

    it("Should move replaced orders to new ID", () => {
        timeTracker.onReport(FX_NEW_BUY_ORDER);
        expect(timeTracker["orders"]).toEqual({"NEW_BUY_ORDER_1": 1479427200});

        timeTracker.onReport(FX_REPLACED_BUY_ORDER);
        expect(timeTracker["orders"]).toEqual({"NEW_BUY_ORDER_2": 1479427200});
    });

    it("Should log time of correct order when multiple orders are placed", () => {
        timeTracker.onReport(FX_NEW_BUY_ORDER);

        jest.spyOn(Date, "now").mockImplementation(() => 1479427200000 + (60 * 5) * 1000);
        timeTracker.onReport(FX_NEW_SELL_ORDER);

        jest.spyOn(Date, "now").mockImplementation(() => 1479427200000 + (60 * 10) * 1000);
        timeTracker.onReport(FX_FILLED_BUY_ORDER);
        expect(orderLogger.info).toHaveBeenNthCalledWith(1, "Open time: 600 filled");

        jest.spyOn(Date, "now").mockImplementation(() => 1479427200000 + (60 * 20) * 1000);
        timeTracker.onReport(FX_FILLED_SELL_ORDER);
        expect(orderLogger.info).toHaveBeenNthCalledWith(2, "Open time: 900 filled");
    });
});
