/**
 * Official TOON Library Test Examples
 *
 * Run: npx ts-node src/api/assistant/tools/toon-official-test.ts
 */

import { toTOON, fromTOON, calculateSavings } from './toon-official-wrapper';

console.log("🧪 Testing Official TOON Library\n");
console.log("=".repeat(60));

// Test 1: Simple order data
console.log("\n=== Test 1: Single Order ===");
const singleOrder = {
  success: true,
  data: {
    results: [
      {
        orderNo: "ORD-2025-001",
        customer: "محمد أحمد علي",
        status: "Completed",
        id: 123,
        createdAt: "2025-08-15T10:30:45.123Z",
        cash: 1500
      }
    ],
    total: 1
  }
};

const jsonStr1 = JSON.stringify(singleOrder, null, 2);
const toonStr1 = toTOON(singleOrder);
const savings1 = calculateSavings(jsonStr1, toonStr1);

console.log("\n📄 Original JSON:");
console.log(jsonStr1);
console.log("\n✨ TOON Format:");
console.log(toonStr1);
console.log(`\n💰 Savings: ${savings1.percentage}% (${savings1.saved} tokens)`);
console.log("─".repeat(60));

// Test 2: Multiple orders
console.log("\n=== Test 2: Multiple Orders ===");
const multipleOrders = {
  success: true,
  data: {
    results: [
      {
        orderNo: "ORD-001",
        customer: "Ahmed",
        status: "Completed",
        id: 1,
        createdAt: "2025-08-01T10:00:00.000Z",
        cash: 1000
      },
      {
        orderNo: "ORD-002",
        customer: "Mohammed",
        status: "Pending",
        id: 2,
        createdAt: "2025-08-02T11:00:00.000Z",
        cash: 1500
      },
      {
        orderNo: "ORD-003",
        customer: "Fatima",
        status: "Completed",
        id: 3,
        createdAt: "2025-08-03T12:00:00.000Z",
        cash: 2000
      }
    ],
    total: 3
  }
};

const jsonStr2 = JSON.stringify(multipleOrders);
const toonStr2 = toTOON(multipleOrders);
const savings2 = calculateSavings(jsonStr2, toonStr2);

console.log("Original JSON size:", jsonStr2.length, "chars");
console.log("TOON size:", toonStr2.length, "chars");
console.log("\n✨ TOON Format:");
console.log(toonStr2);
console.log(`\n💰 Savings: ${savings2.percentage}% (${savings2.saved} tokens)`);
console.log("─".repeat(60));

// Test 3: Round-trip test (lossless)
console.log("\n=== Test 3: Lossless Round-Trip Test ===");
const testData = {
  success: true,
  data: {
    results: [
      {
        orderNo: "TEST-001",
        customer: "Test User",
        cash: 500,
        status: "Completed"
      }
    ],
    total: 1
  }
};

const toonEncoded = toTOON(testData);
const decoded = fromTOON(toonEncoded);

console.log("Original:", JSON.stringify(testData));
console.log("\n✨ TOON Encoded:");
console.log(toonEncoded);
console.log("\n🔄 Decoded back:");
console.log(JSON.stringify(decoded));
console.log("\n✅ Lossless:", JSON.stringify(testData) === JSON.stringify(decoded));
console.log("─".repeat(60));

// Test 4: Large dataset simulation
console.log("\n=== Test 4: Large Dataset (50 orders) ===");
const largeDataset = {
  success: true,
  data: {
    results: Array.from({ length: 50 }, (_, i) => ({
      orderNo: `ORD-2025-${String(i + 1).padStart(3, '0')}`,
      customer: `Customer ${i + 1}`,
      status: i % 3 === 0 ? "Completed" : i % 3 === 1 ? "Pending" : "Processing",
      id: i + 1,
      createdAt: `2025-08-${String((i % 28) + 1).padStart(2, '0')}T10:30:45.123Z`,
      cash: (i + 1) * 100
    })),
    total: 50
  }
};

const jsonStr4 = JSON.stringify(largeDataset);
const toonStr4 = toTOON(largeDataset);
const savings4 = calculateSavings(jsonStr4, toonStr4);

console.log("Original JSON size:", (jsonStr4.length / 1024).toFixed(2), "KB");
console.log("TOON size:", (toonStr4.length / 1024).toFixed(2), "KB");
console.log(`\n💰 Savings: ${savings4.percentage}% (~${savings4.saved} tokens)`);
console.log(`💵 Cost savings: ~$${(savings4.saved * 0.000003).toFixed(6)} per call`);
console.log("\n✨ TOON Preview (first 500 chars):");
console.log(toonStr4.substring(0, 500) + "...");
console.log("─".repeat(60));

// Test 5: Nested data
console.log("\n=== Test 5: Nested Data Structure ===");
const nestedData = {
  success: true,
  data: {
    order: {
      orderNo: "ORD-123",
      customer: {
        name: "John Doe",
        email: "john@example.com",
        address: {
          street: "123 Main St",
          city: "London"
        }
      },
      items: [
        { id: 1, product: "Product A", quantity: 2, price: 50 },
        { id: 2, product: "Product B", quantity: 1, price: 100 }
      ]
    },
    total: 200
  }
};

const jsonStr5 = JSON.stringify(nestedData);
const toonStr5 = toTOON(nestedData);
const savings5 = calculateSavings(jsonStr5, toonStr5);

console.log("\n✨ TOON Format:");
console.log(toonStr5);
console.log(`\n💰 Savings: ${savings5.percentage}% (${savings5.saved} tokens)`);
console.log("─".repeat(60));

// Summary
console.log("\n📊 Summary Statistics:");
console.log("─".repeat(60));
const allTests = [savings1, savings2, savings4, savings5];
const avgSavings = Math.round(
  allTests.reduce((sum, s) => sum + s.percentage, 0) / allTests.length
);
const totalSaved = allTests.reduce((sum, s) => sum + s.saved, 0);

console.log(`Average savings: ${avgSavings}%`);
console.log(`Total tokens saved: ${totalSaved}`);
console.log(`Estimated cost savings: $${(totalSaved * 0.000003).toFixed(6)}`);
console.log("\n✅ All tests completed successfully!");
console.log("=".repeat(60));
