// Subject: High-Frequency Limit Order Book & Trade Matching Engine
// Legacy Inefficiencies: O(N^2) full linear scans, JSON deep-cloning in hot path, unindexed searches, synchronous garbage allocations

class OrderBook {
  constructor() {
    this.bids = []; // Array of { id, price, size, timestamp }
    this.asks = []; // Array of { id, price, size, timestamp }
    this.tradeHistory = [];
  }

  // O(N^2) matching and array splicing on every insert
  addOrder(order) {
    // Inefficiency 1: Heavy deep cloning on every single trade message
    const orderCopy = JSON.parse(JSON.stringify(order));
    orderCopy.timestamp = Date.now();

    if (orderCopy.side === 'buy') {
      // Inefficiency 2: Linear scan and bubble sort on every insert
      this.bids.push(orderCopy);
      this.bids.sort((a, b) => b.price - a.price); // O(N log N) per tick
      this.matchOrders();
    } else {
      this.asks.push(orderCopy);
      this.asks.sort((a, b) => a.price - b.price);
      this.matchOrders();
    }
  }

  matchOrders() {
    // Inefficiency 3: Quadratic nested scanning across all bids and asks
    for (let i = 0; i < this.bids.length; i++) {
      for (let j = 0; j < this.asks.length; j++) {
        const bid = this.bids[i];
        const ask = this.asks[j];

        if (bid && ask && bid.price >= ask.price && bid.size > 0 && ask.size > 0) {
          const matchSize = Math.min(bid.size, ask.size);
          const matchPrice = ask.price;

          bid.size -= matchSize;
          ask.size -= matchSize;

          // Inefficiency 4: Allocating new object and pushing to unbounded history array
          this.tradeHistory.push({
            tradeId: Math.random().toString(36).substring(2),
            price: matchPrice,
            size: matchSize,
            time: Date.now()
          });

          if (bid.size === 0) {
            this.bids.splice(i, 1);
            i--;
          }
          if (ask.size === 0) {
            this.asks.splice(j, 1);
            j--;
          }
        }
      }
    }
  }

  getDepth(levels = 10) {
    // Inefficiency 5: Full map & slice allocation on hot telemetry calls
    return {
      bids: this.bids.slice(0, levels).map(b => [b.price, b.size]),
      asks: this.asks.slice(0, levels).map(a => [a.price, a.size])
    };
  }
}

module.exports = { OrderBook };
