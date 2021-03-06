import moment from "moment";
import LocalOrderCreator from "../../../../sockTrader/core/exchange/orderCreators/localOrderCreator";
import OrderTracker from "../../../../sockTrader/core/order/orderTracker";
import {OrderSide} from "../../../../sockTrader/core/types/order";
import Wallet from "../../../../sockTrader/core/wallet/wallet";
import {Candle} from "../../../../sockTrader/core/types/candle";
import {FX_FILLED_BUY_ORDER, FX_NEW_BUY_ORDER} from "../../../../__fixtures__/order";

let localOrderCreator = new LocalOrderCreator(new OrderTracker(), new Wallet({"USD": 1000}));
beforeEach(() => {
    localOrderCreator = new LocalOrderCreator(new OrderTracker(), new Wallet({"USD": 1000}));
});

describe("cancelOrder", () => {
    it("Should set cancel order as unconfirmed", () => {
        const spy = jest.spyOn(localOrderCreator["orderTracker"], "setOrderUnconfirmed");

        localOrderCreator.cancelOrder(FX_FILLED_BUY_ORDER);

        expect(spy).toBeCalledWith("NEW_BUY_ORDER_1");
    });

    it("Should send order cancellation to orderTracker", () => {
        const spy = jest.spyOn(localOrderCreator["orderTracker"], "process");

        localOrderCreator.cancelOrder(FX_FILLED_BUY_ORDER);

        expect(spy).toBeCalledWith(expect.objectContaining({
            id: "NEW_BUY_ORDER_1",
            price: 100,
            quantity: 1,
            status: "canceled",
            reportType: "canceled",
        }));
    });
});

describe("createOrder", () => {
    it("Should set new order as unconfirmed", () => {
        const spy = jest.spyOn(localOrderCreator["orderTracker"], "setOrderUnconfirmed");

        localOrderCreator.createOrder(["BTC", "USD"], 100, 1, OrderSide.BUY);

        expect(spy).toBeCalledWith(expect.any(String));
    });

    it("Should process newly created order by orderTracker", () => {
        const spy = jest.spyOn(localOrderCreator["orderTracker"], "process");

        localOrderCreator.createOrder(["BTC", "USD"], 100, 1, OrderSide.BUY);

        expect(spy).toBeCalledWith({
            createdAt: expect.any(moment),
            id: expect.any(String),
            pair: ["BTC", "USD"],
            price: 100,
            quantity: 1,
            reportType: "new",
            side: "buy",
            status: "new",
            timeInForce: "GTC",
            type: "limit",
            updatedAt: expect.any(moment),
        });
    });

    it("Should validate order in wallet", () => {
        const allowSpy = jest.spyOn(localOrderCreator["wallet"], "isOrderAllowed");
        const updateSpy = jest.spyOn(localOrderCreator["wallet"], "updateAssets");

        localOrderCreator.createOrder(["BTC", "USD"], 100, 1, OrderSide.BUY);

        expect(allowSpy).toBeCalledWith(expect.objectContaining({pair: ["BTC", "USD"], price: 100, quantity: 1}));
        expect(updateSpy).toBeCalledWith(expect.objectContaining({pair: ["BTC", "USD"], price: 100, quantity: 1}));
    });

    it("Should block order creation if insufficient funds", () => {
        localOrderCreator["wallet"].isOrderAllowed = jest.fn(() => false);
        const updateSpy = jest.spyOn(localOrderCreator["wallet"], "updateAssets");

        localOrderCreator.createOrder(["BTC", "USD"], 100, 1, OrderSide.BUY);

        expect(updateSpy).toBeCalledTimes(0);
    });
});

describe("adjustOrder", () => {
    it("Should process adjusted order by orderTracker", () => {
        const exchangeSpy = jest.spyOn(localOrderCreator["orderTracker"], "process");

        localOrderCreator.adjustOrder(FX_NEW_BUY_ORDER, 10, 1);

        expect(exchangeSpy).toBeCalledWith({
            id: expect.any(String),
            originalId: "NEW_BUY_ORDER_1",
            pair: ["BTC", "USD"],
            price: 10,
            quantity: 1,
            reportType: "replaced",
            side: "buy",
            type: "limit",
            status: "new",
            timeInForce: "GTC",
            createdAt: expect.any(moment),
            updatedAt: expect.any(moment),
        });
    });

    it("Should set new order as unconfirmed", () => {
        const spy = jest.spyOn(localOrderCreator["orderTracker"], "setOrderUnconfirmed");

        localOrderCreator.adjustOrder(FX_NEW_BUY_ORDER, 10, 1);

        expect(spy).toBeCalledWith(expect.any(String));
    });

    it("Should validate order adjustment in wallet", () => {
        const allowSpy = jest.spyOn(localOrderCreator["wallet"], "isOrderAllowed");
        const updateSpy = jest.spyOn(localOrderCreator["wallet"], "updateAssets");

        localOrderCreator.adjustOrder(FX_NEW_BUY_ORDER, 10, 2);

        expect(allowSpy).toBeCalledWith(expect.objectContaining({price: 10, quantity: 2}));
        expect(updateSpy).toBeCalledWith(
            expect.objectContaining({price: 10, quantity: 2}),
            expect.objectContaining({price: 100, quantity: 1}),
        );
    });

    it("Should block order adjustment if insufficient funds", () => {
        localOrderCreator["wallet"].isOrderAllowed = jest.fn(() => false);
        const updateSpy = jest.spyOn(localOrderCreator["wallet"], "updateAssets");

        localOrderCreator.adjustOrder(FX_NEW_BUY_ORDER, 10, 1);
        expect(updateSpy).toBeCalledTimes(0);
    });
});

describe("getTimeOfOrder", () => {
    it("Should return time of current candle", () => {
        const currentTime = moment("2019-01-24 18:00");
        localOrderCreator.setCurrentCandle({timestamp: currentTime} as Candle);

        const timestamp = localOrderCreator["getTimeOfOrder"]();

        expect(timestamp).toEqual(currentTime);
    });

    it("Should return server time", () => {
        const timestamp = localOrderCreator["getTimeOfOrder"]();
        expect(timestamp.diff(moment(), "minutes")).toEqual(0);
    });
});
