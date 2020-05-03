let transactions = [];
let myChart;

sendLocalToDB()
fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    console.log("List of stored transactions: " + JSON.stringify(data))
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveOffline(transaction);
    console.log("Offline transaction saved: " + JSON.stringify(transaction))

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

function saveOffline(data){

  const request = generateindexedDB()

  // Opens a transaction, accesses the toDoList objectStore and statusIndex.
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction(["offlineTransactions"], "readwrite");//[offlineTransactions]
    const transactionStore = transaction.objectStore("offlineTransactions");//offlineTransactions
    const transactionIndex = transactionStore.index("transactionIndex");//index

    // Adds data to our objectStore
    transactionStore.add({ transID: data.date, status: "LocalStored", name: data.name, value: data.value });//transid will be time in which transaction was made, status will be whether or not it has been stored in db
    // transactionStore.add({ transID: "2", status: "inDB" });

    // Return an item by index
    const getRequestIdx = transactionIndex.getAll("LocalStored");
    getRequestIdx.onsuccess = () => {
      console.log("this is an array of the locally stored objects: " + JSON.stringify(getRequestIdx.result));
      // sendLocalToDB()
    }; 
  };
} 

async function sendLocalToDB(){
  const request = generateindexedDB()

  request.onsuccess = async function() {
    const db = request.result
    const transaction = db.transaction(["offlineTransactions"], "readwrite");
    const transactionStore = transaction.objectStore("offlineTransactions");//offlineTransactions
    const transactionIndex = transactionStore.index("transactionIndex");
    const getRequest = transactionIndex.getAll("LocalStored")

    getRequest.onsuccess = async function() {
      console.log("getrequest in sendToLocalDB: " + JSON.stringify(getRequest.result))
      for(let i = 0; i < getRequest.result.length; i++){
        console.log("plus one: "+ JSON.stringify(getRequest.result[i]))
        let data = {
          name: getRequest.result[i].name,
          value: getRequest.result[i].value,
          date: getRequest.result[i].transID
        }
        fetch("/api/transaction", {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json"
          }
        })
        .then(function(response){
          return response.json
        })
      }
    }
  }
}


function generateindexedDB(){
  const request = window.indexedDB.open("offlineTransactionDB", 1);//offlineTransactionsDB

  // Create schema
  request.onupgradeneeded = event => {
    const db = event.target.result;
    
    // Creates an object store with a listID keypath that can be used to query on.
    const transactionStore = db.createObjectStore("offlineTransactions", {keyPath: "transID"});// transactionStore = offlineTransactions, {transID}
    // Creates a statusIndex that we can query on.
    transactionStore.createIndex("transactionIndex", "status"); //transactionIndex, index
    transactionStore.createIndex("name", "name")
    transactionStore.createIndex("value", "value")
  }
  return request
}