import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCddKRuTHpHtaQ0rLOkMOAb5q6slJ3-ybs",
  authDomain: "project-29b6a.firebaseapp.com",
  databaseURL: "https://project-29b6a-default-rtdb.firebaseio.com/",
  projectId: "project-29b6a",
  storageBucket: "project-29b6a.appspot.com",
  messagingSenderId: "731238594321",
  appId: "1:731238594321:web:71c168ad6f35df2944feb0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let currentInvoiceID = null;
let stockCache = {};

// Format date/time to "26-Apr-2025 14:30:45" format
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const itemInput = document.getElementById("itemNameInput");
  const priceInput = document.querySelector('input[placeholder="Price"]');
  const qtyInput = document.getElementById("quantityInput");
  const itemHint = document.getElementById("itemHint");
  const stockQtyHint = document.getElementById("stockQtyHint");

  const stockRef = ref(db, "stocklist");
  onValue(stockRef, (snap) => {
    stockCache = snap.val() || {};
  });

  // Autocomplete functionality
  itemInput.addEventListener("input", function() {
    const val = this.value.trim().toLowerCase();
    closeAllLists();
    if (!val) { 
      itemHint.textContent = "";
      stockQtyHint.textContent = "";
      priceInput.value = "";
      delete qtyInput.dataset.stockKey;
      delete qtyInput.dataset.stockQuantity;
      return false;
    }
    
    const matches = [];
    for (let key in stockCache) {
      const item = stockCache[key];
      if (item.ItemName.toLowerCase().includes(val)) {
        matches.push({
          name: item.ItemName,
          price: item.Price,
          stockKey: key,
          quantity: item.Quantity
        });
      }
    }
    
    if (matches.length > 0) {
      const list = document.createElement("div");
      list.setAttribute("id", this.id + "-autocomplete-list");
      list.setAttribute("class", "autocomplete-items");
      this.parentNode.appendChild(list);
      
      matches.forEach(match => {
        const item = document.createElement("div");
        item.innerHTML = `<strong>${match.name}</strong> (${match.price})`;
        item.innerHTML += `<input type='hidden' value='${match.name}'>`;
        item.addEventListener("click", function() {
          itemInput.value = match.name;
          priceInput.value = match.price;
          qtyInput.dataset.stockKey = match.stockKey;
          qtyInput.dataset.stockQuantity = match.quantity;
          
          itemHint.textContent = "Stock Item";
          stockQtyHint.textContent = `In Stock: ${match.quantity}`;
          closeAllLists();
        });
        list.appendChild(item);
      });
    }
  });

  function closeAllLists(elmnt) {
    const x = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != itemInput) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }

  document.addEventListener("click", function(e) {
    closeAllLists(e.target);
  });

  loadInvoices();
});

window.clearAllInputs = function () {
  document.getElementById("itemNameInput").value = "";
  document.querySelector('input[placeholder="Description"]').value = "";
  document.querySelector('input[placeholder="Price"]').value = "";
  document.getElementById("quantityInput").value = "";
  document.querySelector('input[placeholder="Discount"]').value = "";
  document.getElementById("cashInput").value = "";

  document.getElementById("itemHint").textContent = "";
  document.getElementById("stockQtyHint").textContent = "";

  const qtyInput = document.getElementById("quantityInput");
  delete qtyInput.dataset.stockKey;
  delete qtyInput.dataset.stockQuantity;

  currentInvoiceID = null;
};

window.saveToFirebase = function () {
  const item = document.getElementById("itemNameInput").value;
  const desc = document.querySelector('input[placeholder="Description"]').value;
  const price = parseFloat(document.querySelector('input[placeholder="Price"]').value);
  const qtyInput = document.getElementById("quantityInput");
  const quantity = parseInt(qtyInput.value);
  const discount = parseFloat(document.querySelector('input[placeholder="Discount"]').value);
  const total = price * quantity * (1 - discount / 100);
  const datetime = new Date().toISOString();

  const stockKey = qtyInput.dataset.stockKey;
  const stockQty = parseInt(qtyInput.dataset.stockQuantity || 0);

  if (stockKey && quantity > stockQty) {
    alert("Not enough stock available.");
    return;
  }

  const data = {
    ItemName: item,
    Description: desc,
    Price: price,
    Quantity: quantity,
    Discount: discount,
    Total: total,
    DateTime: datetime,
    InvoiceID: currentInvoiceID || "INV-" + Date.now()
  };

  const onSaved = () => {
    if (stockKey) {
      update(ref(db, `stocklist/${stockKey}`), {
        Quantity: stockQty - quantity
      });
    }
    loadInvoices();
    alert("Invoice saved!");
    clearAllInputs();
  };

  if (currentInvoiceID) {
    update(ref(db, `invoices/${currentInvoiceID}`), data).then(onSaved);
  } else {
    set(ref(db, `invoices/${data.InvoiceID}`), data).then(onSaved);
  }
};

window.deleteInvoice = function (id) {
  if (confirm("Delete this invoice?")) {
    const invoiceRef = ref(db, "invoices/" + id);
    onValue(invoiceRef, (snap) => {
      const inv = snap.val();
      if (!inv) return;

      const deletedQty = parseInt(inv.Quantity);
      const itemName = inv.ItemName.toLowerCase();

      for (let key in stockCache) {
        const stockItem = stockCache[key];
        if (stockItem.ItemName.toLowerCase() === itemName) {
          const currentQty = parseInt(stockItem.Quantity || 0);
          update(ref(db, `stocklist/${key}`), {
            Quantity: currentQty + deletedQty
          });
          break;
        }
      }

      remove(invoiceRef).then(() => {
        alert("Invoice deleted and stock restored.");
        loadInvoices();
      });
    }, { onlyOnce: true });
  }
};

window.calculateBalance = function () {
  const cash = parseFloat(document.getElementById("cashInput").value) || 0;
  const net = parseFloat(document.getElementById("netAmount").value) || 0;
  document.getElementById("balance").value = (cash - net).toFixed(2);
};

window.moveInvoicesToHistory = function () {
  if (!confirm("Are you sure you want to archive all invoices?")) return;

  const invoicesRef = ref(db, "invoices");

  onValue(invoicesRef, (snap) => {
    const data = snap.val();
    if (!data) {
      alert("No invoices found.");
      return;
    }

    const ops = [];
    for (let id in data) {
      const invoice = data[id];
      ops.push(set(ref(db, `history/${id}`), invoice));
    }

    Promise.all(ops).then(() => {
      remove(invoicesRef).then(() => {
        alert("Invoices moved to history successfully.");
        loadInvoices();
      });
    });
  }, { onlyOnce: true });
};

function loadInvoices() {
  const invoicesRef = ref(db, "invoices");
  onValue(invoicesRef, (snap) => {
    const data = snap.val();
    const tbody = document.querySelector("table tbody");
    tbody.innerHTML = "";

    let totalQty = 0, totalDis = 0, net = 0;

    for (let id in data) {
      const inv = data[id];
      totalQty += parseInt(inv.Quantity);
      totalDis += parseFloat(inv.Discount);
      net += parseFloat(inv.Total);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${inv.InvoiceID}</td>
        <td>${inv.ItemName}</td>
        <td>${inv.Description}</td>
        <td>${inv.Price}</td>
        <td>${inv.Quantity}</td>
        <td>${inv.Discount}</td>
        <td>${inv.Total.toFixed(2)}</td>
        <td>${formatDateTime(inv.DateTime)}</td>
        <td><button class="delete-btn" onclick="deleteInvoice('${inv.InvoiceID}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    }

    document.getElementById("totalQty").value = totalQty;
    document.getElementById("totalDiscount").value = totalDis.toFixed(2);
    document.getElementById("netAmount").value = net.toFixed(2);
    calculateBalance();
  });
}