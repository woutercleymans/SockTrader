import Events from "../events";
import {Order, OrderStatus, ReportType} from "../types/order";

export default class OrderTracker {

    private readonly unconfirmedOrders: Record<string, boolean> = {};
    private openOrders: Order[] = [];

    private setOrderConfirmed(orderId: string) {
        delete this.unconfirmedOrders[orderId];
    }

    private replaceOpenOrder(newOrder: Order, oldOrderId: string): Order | undefined {
        const oldOrder = this.findOpenOrder(oldOrderId);
        this.removeOpenOrder(oldOrderId);
        this.addOpenOrder(newOrder);

        return oldOrder;
    }

    private addOpenOrder(order: Order) {
        this.openOrders.push(order);
    }

    private removeOpenOrder(orderId: string) {
        this.openOrders = this.openOrders.filter(o => o.id !== orderId);
    }

    private findOpenOrder(orderId: string) {
        return this.openOrders.find(openOrder => openOrder.id === orderId);
    }

    isOrderUnconfirmed(orderId: string) {
        return this.unconfirmedOrders[orderId] !== undefined;
    }

    setOrderUnconfirmed(orderId: string) {
        this.unconfirmedOrders[orderId] = true;
    }

    getOpenOrders() {
        return this.openOrders;
    }

    setOpenOrders(orders: Order[]) {
        this.openOrders = orders;
    }

    /**
     * Processes order depending on the reportType
     * @param order
     */
    process(order: Order) {
        const orderId = order.id;
        let oldOrder: Order | undefined;

        this.setOrderConfirmed(orderId);

        if (order.reportType === ReportType.REPLACED && order.originalId) {
            this.setOrderConfirmed(order.originalId);
            oldOrder = this.replaceOpenOrder(order, order.originalId);
        } else if (order.reportType === ReportType.NEW) {
            this.addOpenOrder(order); // New order created
        } else if (order.reportType === ReportType.TRADE && order.status === OrderStatus.FILLED) {
            this.removeOpenOrder(orderId); // Order is 100% filled
        } else if ([ReportType.CANCELED, ReportType.EXPIRED, ReportType.SUSPENDED].indexOf(order.reportType) > -1) {
            this.removeOpenOrder(orderId); // Order is invalid
        }

        Events.emit("core.report", order, oldOrder);
    }
}
