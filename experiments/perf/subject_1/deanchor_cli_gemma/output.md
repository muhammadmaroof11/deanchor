## Limit Order Book Matching Algorithm

This algorithm aims to match buy and sell orders in a limit order book with O(log N) complexity for matching.

**Data Structures:**

* **Bids:** A balanced binary search tree (BST) storing buy orders. 
    - The key is the price, ensuring non-decreasing order.
    - Each node holds the order size and timestamp.
* **Asks:** A balanced BST storing sell orders.
    - The key is the price, ensuring non-increasing order.
    - Each node holds the order size and timestamp.

**Algorithm:**

1. **Order Insertion:** 
   - For each incoming buy order:
      - Insert it into the `Bids` tree.
   - For each incoming sell order:
      - Insert it into the `Asks` tree.

2. **Matching Orders:**
   - Iterate through incoming buy orders.
     - Find the highest matching sell order in `Asks` (price >= buy order price).
     - If found:
        - Execute a trade up to the minimum of the remaining sizes on both sides.
        - Update the `Bids` and `Asks` trees by removing/reducing the executed quantities.
        - Record the executed trade details (price, size, timestamps).
     - If no matching sell order found, store the buy order for later matching.

3. **Cleanup:**
   - Periodically remove stale orders from both `Bids` and `Asks` based on a defined time threshold.

**Complexity Analysis:**

* Insertion: O(log N) due to balanced BST operations.
* Matching: O(log N) for finding the highest matching sell order in `Asks`.
* Cleanup: O(N log N) in the worst case, but can be optimized with techniques like linked lists for stale orders and periodic pruning.

**Memory Optimization:**

* Flat arrays for storing order details within each BST node to minimize allocation overhead.
* Use a fixed-size pool of order structures to reduce memory fragmentation.

**Edge Case Handling:**

* No matching orders: Store the buy order for later matching.
* Buy order fully consumes a sell order: Remove the sell order from `Asks`.
* Sell order fully consumes a buy order: Remove the buy order from `Bids`.

**Invariant Preservation:**

* `Bids` tree maintains non-decreasing order of prices.
* `Asks` tree maintains non-increasing order of prices.



This algorithm utilizes balanced BSTs to achieve O(log N) complexity for order matching, significantly improving performance over quadratic solutions. Careful memory management techniques are employed to minimize overhead and ensure efficient execution. 


