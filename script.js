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
    // const response = await fetch("https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/UCLevel/UCCodeData.json");
    const response = await fetch("https://itp-dynamic-pricing.s3.eu-central-1.amazonaws.com/ES_JSON_Data/ES-UCLevel/ES-UCCodeData.json");
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
// getData('134010', 12);
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

    // const ucCode_arrays = {
    //     '1004295': [75910, 76629, 52517, 52478],
    //     '111093': [70172, 70173],
    //     '124602': [58697],
    //     '134010': [75213, 74873, 58317],
    //     '142234': [59961, 72286, 72287],
    //     '143557': [53899],
    //     '160831': [52296],
    //     '194935': [70235, 70236],
    //     '227811': [75334, 56143, 56147, 56917, 75289, 75290, 56351],
    //     '230721': [41536, 58393],
    //     '237317': [58721, 39852, 39398],
    //     '252519': [53113, 44098, 61181],
    //     '258288': [45961, 77460, 55341],
    //     '288187': [45797],
    //     '333374': [48568, 48506],
    //     '333375': [72403, 53023],
    //     '339889': [72994],
    //     '340034': [63861],
    //     '345112': [53713, 53718, 63391],
    //     '4031114': [65930, 65950],
    //     '4049302': [62239],
    //     '4051344': [62385, 62244],
    //     '4053403': [64278, 63879],
    //     '4068936': [68066, 62109],
    //     '4121168': [71200, 71199, 71191],
    //     '4126585': [73545, 73514],
    //     '4161711': [76065],
    //     '4176488': [78841, 78902]
    // }

    const ucCode_arrays = {
        '1004295': [69097, 1002666, 62730, 30773, 68502],
        '1004327': [44850, 42686],
        '1004467': [1001187],
        '1004551': [1002843, 25251, 1002838],
        '1008905': [53744],
        '1008939': [62137],
        '111093': [41473, 15973, 57447, 15975, 60079],
        '119071': [29896, 30009, 57732],
        '125190': [24734],
        '125695': [27117, 11867, 73453],
        '128345': [60036, 57701, 57502],
        '131876': [65945, 67901],
        '133186': [76926],
        '134010': [32942],
        '139463': [70241, 64783, 65457, 70259, 47606, 47832],
        '141088': [62060, 62061],
        '142973': [68912, 47698, 16125],
        '153491': [60364, 19628, 19633, 19667, 59925],
        '160967': [32995],
        '166773': [54186, 25639],
        '170776': [41420, 61431],
        '173354': [65712, 65711],
        '178080': [43776, 57067, 75031],
        '184200': [65014],
        '186881': [62701],
        '189148': [33146, 39381, 46495],
        '191349': [62875],
        '191596': [43929, 45700],
        '194669': [53109],
        '194935': [42275],
        '197210': [65803, 65804],
        '198971': [72209, 72242, 72210],
        '211093': [44217, 44218, 27889, 27821],
        '211570': [54675, 54990],
        '211573': [65722, 68510],
        '212215': [42881, 42882, 47910, 43918, 42930],
        '215850': [33992, 33993],
        '215985': [67584, 67881],
        '220012': [60137, 41318, 41319],
        '222389': [43133, 42991],
        '227811': [42856, 42857, 60379],
        '230721': [53117],
        '237151': [66282, 57523, 69685],
        '237317': [39808, 39850],
        '240224': [15671],
        '252519': [57252, 57259, 47116, 47025, 77937, 77938, 67228],
        '258288': [54408, 56777, 77940],
        '276529': [72936],
        '288187': [59089],
        '288495': [47136, 47140],
        '299521': [43089],
        '308555': [79907, 51342],
        '323045': [63800],
        '327418': [46444],
        '327420': [54028],
        '333374': [52138, 51780, 77942],
        '333375': [77945, 54677, 54678],
        '339889': [63146, 70709, 62518],
        '340034': [62807],
        '343226': [47530],
        '344368': [72473],
        '345112': [53532, 53533],
        '345114': [53650, 53652],
        '362095': [67754, 67726, 67727],
        '4019328': [63216, 71760],
        '4021280': [57092, 75415],
        '4021282': [74297],
        '4028015': [54523, 54524],
        '4029506': [54745],
        '4031114': [66467, 66468],
        '4033733': [68010],
        '4035318': [78944],
        '4039618': [74922],
        '4048391': [73235],
        '4049302': [62507, 63518, 64883],
        '4051001': [61595, 61740],
        '4051344': [64496],
        '4053403': [65904, 65890, 65887],
        '4054890': [58432],
        '4061124': [75512, 75513, 75540],
        '4063643': [64038, 64063],
        '4065859': [63994],
        '4067367': [69451],
        '4068936': [77952, 72139],
        '4071232': [71889],
        '4083971': [62801],
        '4085376': [63258, 63274],
        '4085916': [72531, 63245],
        '4097943': [69646],
        '4106142': [71292],
        '4107705': [67585],
        '4107924': [67586],
        '4107957': [68186],
        '4108521': [70799],
        '4108556': [80183],
        '4110533': [75093],
        '4111152': [73088, 73085],
        '4112587': [68065],
        '4114026': [67836],
        '4116674': [68427],
        '4116948': [71944],
        '4117401': [68436],
        '4117403': [68470],
        '4121168': [70080, 70081, 70082],
        '4124063': [81448],
        '4129844': [70687],
        '4133887': [71327],
        '4138534': [76612, 76693, 76614],
        '4138537': [78983],
        '4143083': [76563],
        '4143098': [78178],
        '4143101': [76676],
        '4143102': [76610],
        '4144530': [78182],
        '4144535': [78176],
        '4145311': [79633],
        '4145448': [76566],
        '4145449': [76605],
        '4145554': [76568],
        '4145696': [79629],
        '4146311': [76565],
        '4146316': [79677],
        '4146320': [79666],
        '4146335': [76569, 76603],
        '4146344': [76902],
        '4146346': [79672],
        '4149604': [74421],
        '4152565': [73993, 73978],
        '4152676': [74143],
        '4152733': [73891],
        '4152914': [73861],
        '4153982': [74526],
        '4155697': [76678],
        '4161711': [75300],
        '4170159': [76212],
        '4170342': [76138],
        '4172570': [76727],
        '4172825': [76695],
        '4172861': [76699],
        '4172879': [76690],
        '4172918': [76694],
        '4173124': [76697],
        '4173125': [76698],
        '4173126': [76700],
        '4173300': [76692],
        '4173318': [78210],
        '4173325': [78174],
        '4173542': [79646],
        '4173549': [79647],
        '4173624': [79663],
        '4173625': [79664],
        '4173630': [79665],
        '4173631': [79674],
        '4174231': [78213],
        '4174288': [79639],
        '4174290': [79642],
        '4174460': [78272],
        '4184438': [79934],
        '4185177': [80845],
        '4189149': [80804],
        '60228': [35168, 15521, 13959]
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

    // const c = {
    //     '1004295': [75910, 76629, 52517, 52478],
    //     '111093': [70172, 70173],
    //     '124602': [58697],
    //     '134010': [75213, 74873, 58317],
    //     '142234': [59961, 72286, 72287],
    //     '143557': [53899],
    //     '160831': [52296],
    //     '194935': [70235, 70236],
    //     '227811': [75334, 56143, 56147, 56917, 75289, 75290, 56351],
    //     '230721': [41536, 58393],
    //     '237317': [58721, 39852, 39398],
    //     '252519': [53113, 44098, 61181],
    //     '258288': [45961, 77460, 55341],
    //     '288187': [45797],
    //     '333374': [48568, 48506],
    //     '333375': [72403, 53023],
    //     '339889': [72994],
    //     '340034': [63861],
    //     '345112': [53713, 53718, 63391],
    //     '4031114': [65930, 65950],
    //     '4049302': [62239],
    //     '4051344': [62385, 62244],
    //     '4053403': [64278, 63879],
    //     '4068936': [68066, 62109],
    //     '4121168': [71200, 71199, 71191],
    //     '4126585': [73545, 73514],
    //     '4161711': [76065],
    //     '4176488': [78841, 78902]
    // }
    const c = {
        '1004295': [69097, 1002666, 62730, 30773, 68502],
        '1004327': [44850, 42686],
        '1004467': [1001187],
        '1004551': [1002843, 25251, 1002838],
        '1008905': [53744],
        '1008939': [62137],
        '111093': [41473, 15973, 57447, 15975, 60079],
        '119071': [29896, 30009, 57732],
        '125190': [24734],
        '125695': [27117, 11867, 73453],
        '128345': [60036, 57701, 57502],
        '131876': [65945, 67901],
        '133186': [76926],
        '134010': [32942],
        '139463': [70241, 64783, 65457, 70259, 47606, 47832],
        '141088': [62060, 62061],
        '142973': [68912, 47698, 16125],
        '153491': [60364, 19628, 19633, 19667, 59925],
        '160967': [32995],
        '166773': [54186, 25639],
        '170776': [41420, 61431],
        '173354': [65712, 65711],
        '178080': [43776, 57067, 75031],
        '184200': [65014],
        '186881': [62701],
        '189148': [33146, 39381, 46495],
        '191349': [62875],
        '191596': [43929, 45700],
        '194669': [53109],
        '194935': [42275],
        '197210': [65803, 65804],
        '198971': [72209, 72242, 72210],
        '211093': [44217, 44218, 27889, 27821],
        '211570': [54675, 54990],
        '211573': [65722, 68510],
        '212215': [42881, 42882, 47910, 43918, 42930],
        '215850': [33992, 33993],
        '215985': [67584, 67881],
        '220012': [60137, 41318, 41319],
        '222389': [43133, 42991],
        '227811': [42856, 42857, 60379],
        '230721': [53117],
        '237151': [66282, 57523, 69685],
        '237317': [39808, 39850],
        '240224': [15671],
        '252519': [57252, 57259, 47116, 47025, 77937, 77938, 67228],
        '258288': [54408, 56777, 77940],
        '276529': [72936],
        '288187': [59089],
        '288495': [47136, 47140],
        '299521': [43089],
        '308555': [79907, 51342],
        '323045': [63800],
        '327418': [46444],
        '327420': [54028],
        '333374': [52138, 51780, 77942],
        '333375': [77945, 54677, 54678],
        '339889': [63146, 70709, 62518],
        '340034': [62807],
        '343226': [47530],
        '344368': [72473],
        '345112': [53532, 53533],
        '345114': [53650, 53652],
        '362095': [67754, 67726, 67727],
        '4019328': [63216, 71760],
        '4021280': [57092, 75415],
        '4021282': [74297],
        '4028015': [54523, 54524],
        '4029506': [54745],
        '4031114': [66467, 66468],
        '4033733': [68010],
        '4035318': [78944],
        '4039618': [74922],
        '4048391': [73235],
        '4049302': [62507, 63518, 64883],
        '4051001': [61595, 61740],
        '4051344': [64496],
        '4053403': [65904, 65890, 65887],
        '4054890': [58432],
        '4061124': [75512, 75513, 75540],
        '4063643': [64038, 64063],
        '4065859': [63994],
        '4067367': [69451],
        '4068936': [77952, 72139],
        '4071232': [71889],
        '4083971': [62801],
        '4085376': [63258, 63274],
        '4085916': [72531, 63245],
        '4097943': [69646],
        '4106142': [71292],
        '4107705': [67585],
        '4107924': [67586],
        '4107957': [68186],
        '4108521': [70799],
        '4108556': [80183],
        '4110533': [75093],
        '4111152': [73088, 73085],
        '4112587': [68065],
        '4114026': [67836],
        '4116674': [68427],
        '4116948': [71944],
        '4117401': [68436],
        '4117403': [68470],
        '4121168': [70080, 70081, 70082],
        '4124063': [81448],
        '4129844': [70687],
        '4133887': [71327],
        '4138534': [76612, 76693, 76614],
        '4138537': [78983],
        '4143083': [76563],
        '4143098': [78178],
        '4143101': [76676],
        '4143102': [76610],
        '4144530': [78182],
        '4144535': [78176],
        '4145311': [79633],
        '4145448': [76566],
        '4145449': [76605],
        '4145554': [76568],
        '4145696': [79629],
        '4146311': [76565],
        '4146316': [79677],
        '4146320': [79666],
        '4146335': [76569, 76603],
        '4146344': [76902],
        '4146346': [79672],
        '4149604': [74421],
        '4152565': [73993, 73978],
        '4152676': [74143],
        '4152733': [73891],
        '4152914': [73861],
        '4153982': [74526],
        '4155697': [76678],
        '4161711': [75300],
        '4170159': [76212],
        '4170342': [76138],
        '4172570': [76727],
        '4172825': [76695],
        '4172861': [76699],
        '4172879': [76690],
        '4172918': [76694],
        '4173124': [76697],
        '4173125': [76698],
        '4173126': [76700],
        '4173300': [76692],
        '4173318': [78210],
        '4173325': [78174],
        '4173542': [79646],
        '4173549': [79647],
        '4173624': [79663],
        '4173625': [79664],
        '4173630': [79665],
        '4173631': [79674],
        '4174231': [78213],
        '4174288': [79639],
        '4174290': [79642],
        '4174460': [78272],
        '4184438': [79934],
        '4185177': [80845],
        '4189149': [80804],
        '60228': [35168, 15521, 13959]
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