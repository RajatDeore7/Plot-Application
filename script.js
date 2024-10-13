let xArray = [];
let yArray = [];
let selected_model = {};
let id = 0;
let model_type;
let coefficients;
let intercept;
let user_quantity;
let user_discount;
let result;
let userId;
let dataParent;
let dataParent2;

async function getData(selected_product, received_quantity) {
    console.log("getData called with:", selected_product, received_quantity);
    const response = await fetch("https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/UCLevel/UCCodeData.json");
    const result = await response.json();
    console.log("Fetched data:", result);

    let found = false;
    for (let i = 0; i < result.length; i++) {
        const element = result[i];
        if (element.id === selected_product) {
            xArray = element.x_Array;
            yArray = element.y_Array;
            selected_model = { coefficients: element.coefficients, intercept: element.intercept };
            id = element.id;
            model_type = element.model;
            xArrayPrev = element.x_Array_prev;
            yArrayPrev = element.y_Array_prev;
            xArrayCurr = element.x_Array_curr;
            yArrayCurr = element.y_Array_curr;
            found = true;
            break;
        }
    }

    if (!found) {
        console.error("Product not found:", selected_product);
        return;
    }

    console.log("Selected Product Data:", selected_model);
    console.log("X Array:", xArray);
    console.log("Y Array:", yArray);
    console.log("Product ID:", id);
    console.log("Model Type:", model_type);
    console.log("userId:", userId);

    const { xValues, yValues, upperCIs, lowerCIs } = generateTrendline(selected_model);

    recommendation(received_quantity);
    plotGraphCompleteData(xValues, yValues, upperCIs, lowerCIs, xArrayPrev, yArrayPrev, xArrayCurr, yArrayCurr);
}

function generateTrendline(model) {
    coefficients = model.coefficients;
    intercept = model.intercept;

    const xValues = [];
    const yValues = [];
    const upperCIs = [];
    const lowerCIs = [];

    const arr_X = calculateMax(xArray);

    // Calculate mean and standard deviation of xArray
    const meanX = xArray.reduce((acc, val) => acc + val, 0) / xArray.length;
    const stdDevX = Math.sqrt(xArray.reduce((acc, val) => acc + Math.pow(val - meanX, 2), 0) / xArray.length);

    //Trendline
    for (let x = 1; x <= arr_X; x += 1) {
        xValues.push(x);
        let predictedValue = intercept;
        if (coefficients.length > 1 && model_type === "Polynomial") {
            for (let i = 0; i < coefficients.length; i++) {
                predictedValue += coefficients[i] * Math.pow(x, i);
            }
        } else if (coefficients.length === 1 && model_type === "Logarithmic") {
            for (let i = 0; i < coefficients.length; i++) {
                predictedValue += coefficients[i] * Math.log(x);
            }
        } else {
            for (let i = 0; i < coefficients.length; i++) {
                predictedValue += coefficients[i] * x;
            }
        }
        yValues.push(predictedValue);
        // console.log("Predicted Value:", predictedValue);

        // Calculate Confidence Intervals
        const t = 1; // 95% confidence interval, t-value
        const n = xArray.length; // Number of observations
        let sumResidualsSquared = 0;
        for (let i = 0; i < xArray.length; i++) {
            let modelValue = intercept;
            for (let j = 0; j < coefficients.length; j++) {
                modelValue += coefficients[j] * Math.pow(xArray[i], j);
            }
            const residual = yArray[i] - modelValue;
            sumResidualsSquared += Math.pow(residual, 2);
        }
        const stdError = Math.sqrt((1 / (n - 2)) * sumResidualsSquared);
        const marginOfError = t * stdError * Math.sqrt(1 / n + Math.pow((x - meanX), 2) / ((n - 1) * Math.pow(stdDevX, 2)));

        upperCIs.push(predictedValue + marginOfError);
        lowerCIs.push(predictedValue - marginOfError);
    }

    return { xValues, yValues, upperCIs, lowerCIs };
}

//Recomemeded Discount
function recommendation(received_quantity) {
    let predictedDiscount = intercept;
    if (coefficients.length > 1 && model_type === "Polynomial") {
        for (let i = 0; i < coefficients.length; i++) {
            predictedDiscount += coefficients[i] * Math.pow(received_quantity, i);
        }
    } else if (coefficients.length === 1 && model_type === "Logarithmic") {
        for (let i = 0; i < coefficients.length; i++) {
            predictedDiscount += coefficients[i] * Math.log(received_quantity);
        }
    } else {
        for (let i = 0; i < coefficients.length; i++) {
            predictedDiscount += coefficients[i] * received_quantity;
        }
    }

    // document.querySelector("div.recommended-price").innerHTML = `Recommended Discount : ${predictedDiscount.toFixed(2)}`;
    result = predictedDiscount.toFixed(2);
}

function calculateMedian(arr) {
    const sortedArr = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedArr.length / 2);
    if (sortedArr.length % 2 === 0) {
        return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
    } else {
        return sortedArr[mid];
    }
}

function calculateMin(arr) {
    return Math.min(...arr);
}

function calculateMax(arr) {
    return Math.max(...arr);
}

//Current User Coordinates
function User(Quantity, Discount) {
    user_quantity = Quantity;
    user_discount = Discount;
}

//PlotGraphCompleteData Complete-Data
function plotGraphCompleteData(xValues, yValues, upperCIs, lowerCIs, x_Array_prev, y_Array_prev, x_Array_curr, y_Array_curr) {
    let x_median = calculateMedian(xArray);
    let y_median = calculateMedian(yArray);

    let min_X = calculateMin(xArray) - 1;
    let max_X = calculateMax(xArray) + 5;
    let min_Y = calculateMin(yArray) - 2;
    let max_Y = calculateMax(yArray) + 2;

    const data = [
        { x: xArray, y: yArray, mode: "markers", name: "Sales Weighted Average" },
        { x: xValues, y: yValues, mode: "lines", name: "Trendline" },
        { x: [x_median, x_median], y: [min_X, max_Y], mode: "lines", name: "Mean Quantity" },
        { x: [min_X, max_X], y: [y_median, y_median], mode: "lines", name: "Mean Discount" },
        {
            x: [x_median, x_median, max_X, max_X],
            y: [y_median, max_Y, max_Y, y_median],
            mode: "lines",
            fill: 'toself',
            fillcolor: 'rgba(0, 0, 255, 0.1)', // Blue for Q1
            name: "Increase Price If Possible"
        },
        {
            x: [x_median, x_median, max_X, max_X],
            y: [min_X, y_median, y_median, min_X],
            mode: "lines",
            fill: 'toself',
            fillcolor: 'rgba(0, 255, 0, 0.1)', // Green for Q4
            name: "No Change Required"
        },
        {
            x: [x_median, x_median, min_X, min_X],
            y: [min_X, y_median, y_median, min_X],
            mode: "lines",
            fill: 'toself',
            fillcolor: 'rgba(255, 255, 0, 0.1)', // Yellow for Q3
            name: "Negotiate Quantity and Price"
        },
        {
            x: [min_X, x_median, x_median, min_X],
            y: [y_median, y_median, max_Y, max_Y],
            mode: "lines",
            fill: 'toself',
            fillcolor: 'rgba(255, 0, 0, 0.1)', // Red for Q2
            name: "Remove Deal If Possible"
        },
        {
            x: xValues.concat(xValues.slice().reverse()),
            y: upperCIs.concat(lowerCIs.slice().reverse()),
            fill: 'toself',
            fillcolor: 'rgba(0, 0, 0, 0.2)',
            mode: 'lines',
            line: { color: 'rgba(255, 0, 0, 0)' },
            name: '95% CI'
        },
        {
            x: x_Array_prev,
            y: y_Array_prev,
            mode: 'markers',
            marker: {
                color: 'blue'
            },
            name: '2023 Data',
            visible: 'legendonly'
        },
        {
            x: x_Array_curr,
            y: y_Array_curr,
            mode: 'markers',
            marker: {
                color: 'green'
            },
            name: '2024 Data',
            visible: 'legendonly'
        },
        {
            x: [user_quantity],
            y: [user_discount],
            mode: 'markers',
            marker: {
                color: 'red'
            },
            name: `Customer ID: ${userId}`,
            // text: [userId],
            marker: { size: 11 }
        }

    ];

    const layout = {
        xaxis: { range: [min_X, max_X], title: "Quantity" },
        yaxis: { range: [min_Y, max_Y], title: "Discount" },
        title: `The Recommended Discount for the Selected Product Quantity in UC Level is ${result}`,
        showlegend: true
    };

    Plotly.newPlot("myPlot", data, layout);
}

// PlotGraph Previous Year Data

// Fetch data for a specific product ID
getData('1004295', 12);
// User(12, 10);
// getData(33594);
// getData(38943);
// getData(39852);
// getData(44158);


//getting data request
window.addEventListener('message', function (event) {

    console.log('Message event received:', event);
    // Check the origin of the message
    // if (event.origin !== "https://rajat-developer-dev-ed.develop.lightning.force.com") {
    //     console.error('The message origin does not match the expected origin.');
    //     return;
    // }
    if (event.origin !== "https://syngenta--coeist.sandbox.lightning.force.com") {
        console.error('The message origin does not match the expected origin.');
        return;
    }

    const received = event.data;
    const received_data = JSON.parse(received);
    dataParent = received_data;

    const received_quantity = parseInt(received_data.Quantity__c);
    const received_discount = parseInt(received_data.Discount__c);
    const received_static_discount = parseInt(received_data.StaticDiscount__c);
    const received_discount7 = parseInt(received_data.Discount7__c);
    const received_dynamic_discount = parseInt(received_data.DynamicDiscount__c);
    const totalDiscount = (received_discount || 0) + (received_static_discount || 0) + (received_discount7 || 0) + (received_dynamic_discount || 0);
    userId = received_data.userId;
    console.log("userId:", userId);

    // // console.log("Message received from the parent: ", JSON.parse(received.name));
    // // console.log("Message received from the parent_1: " + received);
    // // console.log("Message received from the parent: " + JSON.stringify(received, null, 2));
    // document.querySelector("div.message1").innerHTML = JSON.stringify(received, null, 2);
    // document.querySelector("div.message2").innerHTML = received;

    const selected_product = parseInt(received_data.SKU__c);

    const ucCode_arrays = {
        '1004295': [75910, 76629, 52517, 52478],
        '111093': [70172, 70173],
        '124602': [58697],
        '134010': [75213, 74873, 58317],
        '142234': [59961, 72286, 72287],
        '143557': [53899],
        '160831': [52296],
        '194935': [70235, 70236],
        '227811': [75334, 56143, 56147, 56917, 75289, 75290, 56351],
        '230721': [41536, 58393],
        '237317': [58721, 39852, 39398],
        '252519': [53113, 44098, 61181],
        '258288': [45961, 77460, 55341],
        '288187': [45797],
        '333374': [48568, 48506],
        '333375': [72403, 53023],
        '339889': [72994],
        '340034': [63861],
        '345112': [53713, 53718, 63391],
        '4031114': [65930, 65950],
        '4049302': [62239],
        '4051344': [62385, 62244],
        '4053403': [64278, 63879],
        '4068936': [68066, 62109],
        '4121168': [71200, 71199, 71191],
        '4126585': [73545, 73514],
        '4161711': [76065],
        '4176488': [78841, 78902]
    }

    let found_array_name = null;

    for (const [name, array] of Object.entries(ucCode_arrays)) {
        if (array.includes(selected_product)) {
            found_array_name = name;
            break;
        }
    }

    if (found_array_name) {
        console.log(`The selected product is in the array: ${found_array_name}`);
    } else {
        console.log('The selected product is not in any array.');
    }

    User(received_quantity, totalDiscount);

    getData(found_array_name, received_quantity);
});

//receive message from parent
function displayData() {
    var urlParams = new URLSearchParams(window.location.search);
    var receivedData = urlParams.get('dataParent');
    console.log('Received data:', receivedData, 'type:', typeof receivedData);

    if (!receivedData) {
        console.error("No data received from SKU");
        return;
    }

    const received_data_SKU = JSON.parse(receivedData);
    console.log('Parsed SKU data:', received_data_SKU);

    dataParent2 = received_data_SKU;

    const received_quantity_SKU = parseInt(received_data_SKU.Quantity__c);
    const received_discount_SKU = parseInt(received_data_SKU.Discount__c);
    const received_static_discount_SKU = parseInt(received_data_SKU.StaticDiscount__c);
    const received_discount7_SKU = parseInt(received_data_SKU.Discount7__c);
    const received_dynamic_discount_SKU = parseInt(received_data_SKU.DynamicDiscount__c);
    const totalDiscount_SKU = (received_discount_SKU || 0) + (received_static_discount_SKU || 0) + (received_discount7_SKU || 0) + (received_dynamic_discount_SKU || 0);
    let skuCode = received_data_SKU.SKU__c;
    userId = received_data_SKU.userId;
    console.log('User Id', userId);

    const c = {
        '1004295': [75910, 76629, 52517, 52478],
        '111093': [70172, 70173],
        '124602': [58697],
        '134010': [75213, 74873, 58317],
        '142234': [59961, 72286, 72287],
        '143557': [53899],
        '160831': [52296],
        '194935': [70235, 70236],
        '227811': [75334, 56143, 56147, 56917, 75289, 75290, 56351],
        '230721': [41536, 58393],
        '237317': [58721, 39852, 39398],
        '252519': [53113, 44098, 61181],
        '258288': [45961, 77460, 55341],
        '288187': [45797],
        '333374': [48568, 48506],
        '333375': [72403, 53023],
        '339889': [72994],
        '340034': [63861],
        '345112': [53713, 53718, 63391],
        '4031114': [65930, 65950],
        '4049302': [62239],
        '4051344': [62385, 62244],
        '4053403': [64278, 63879],
        '4068936': [68066, 62109],
        '4121168': [71200, 71199, 71191],
        '4126585': [73545, 73514],
        '4161711': [76065],
        '4176488': [78841, 78902]
    }

    let found_array_name_SKU = null;

    for (const [name, array] of Object.entries(c)) {
        if (array.includes(parseInt(skuCode))) {
            found_array_name_SKU = name;
            break;
        }
    }

    console.log('Calling getData with:', found_array_name_SKU, received_quantity_SKU);
    getData(found_array_name_SKU, received_quantity_SKU);

    console.log('Calling User with:', received_quantity_SKU, totalDiscount_SKU);
    User(received_quantity_SKU, totalDiscount_SKU);
}

//Open SKU
function openSKU() {
    console.log('UStoSKU:', dataParent, 'UStoSKU2:', dataParent2);
    if (dataParent == undefined) {
        dataParent = dataParent2
        var encodedData = encodeURIComponent(JSON.stringify(dataParent));
        window.location.href = 'https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/SKULevel/index.html?dataParent=' + encodedData;
    }
    var encodedData = encodeURIComponent(JSON.stringify(dataParent));
    window.location.href = 'https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/SKULevel/index.html?dataParent=' + encodedData;
}

//Open Customer
function openCustomer() {
    console.log('UCtoCustomer:', dataParent, 'UCtoCustomer2:', dataParent2);
    if (dataParent == undefined) {
        dataParent = dataParent2
        var encodedData = encodeURIComponent(JSON.stringify(dataParent));
        window.location.href = 'https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/CustomerLevel/index.html?dataParent=' + encodedData;
    }
    var encodedData = encodeURIComponent(JSON.stringify(dataParent));
    window.location.href = 'https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/CustomerLevel/index.html?dataParent=' + encodedData;
}