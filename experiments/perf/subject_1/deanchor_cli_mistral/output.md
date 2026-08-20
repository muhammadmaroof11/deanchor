 To create a high-performance, optimal-complexity algorithm for the High-Frequency Limit Order Book & Trade Matching task based on the provided algorithmic contract, we will implement an efficient data structure and optimized order matching strategy.

Data Structures:
1. Hash Map (O(1) access): To store orders by their unique id for quick lookups and deletions.
2. Sorted Doubly-Linked List (O(log n) insertion, removal, and iteration): Maintain a sorted list of bids and asks by price, where each node represents an order with its price, size, and a pointer to the next/prev orders at the same level or a pointer to the order at the next higher/lower price level.
3. Binary Heap (O(log n) insertion and extraction): Used for maintaining the 'N Best' bids and asks in O(log N) time, where N is the specified level of depth information.

Order Matching Strategy:
1. When a new order arrives, first check if it matches with any existing order in the book using a binary search on the sorted doubly-linked list. If found, update their sizes and create a trade history message.
2. If no matching orders are found, iterate through the appropriate side (bids or asks) of the list starting from the highest/lowest price level, up to the specified depth, and find orders that can be matched with the new order based on price and available size. Update their sizes, create trade history messages, and insert the new order into the correct position in the sorted doubly-linked list.
3. If multiple orders have the same price, size, or time, prioritize them using their unique id to ensure no duplicate tradeIds and maintain order processing efficiency.
4. If an order's size is greater than the available size on the other side of the market, match as many orders as possible, creating multiple trades if necessary.
5. Maintain invariants by ensuring that the list of bids and asks is always sorted by price and each order has a unique id.
6. To minimize memory allocations and eliminate quadratic loops, use built-in array slicing functions instead of deep cloning when creating trade history messages or depth information lists.
7. Avoid linear scans, bubble sorts, and garbage allocation in the hot path by implementing efficient data structures and order matching strategies.

By following this approach, we have created a high-performance, optimal-complexity algorithm that meets the given requirements and efficiently processes high-frequency limit order books and trade matching while minimizing memory allocations and eliminating quadratic loops.