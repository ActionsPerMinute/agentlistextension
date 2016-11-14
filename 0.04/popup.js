var count=0;
var newData = []
var dataobj = {}
var nodes = {};
var tiers = {};
var applications = {};
var sec="";

document.addEventListener('DOMContentLoaded', init);

function init(){
    $("#controller").keypress(function(event) {
        if (event.which == 13) { go(); }
    })
}

function go() {
    $("#go").attr("disabled", "disabled");
    $("#controller").attr("disabled", "disabled");
    $('#progress').text("Calling");
    var domain = $("#controller")[0].value;
    if ($('#secure')[0].checked)
        sec = 's';
    $.ajax({
        url: "http"+sec+"://"+domain+"/controller/rest/applications?output=json",
        error: function() {
            $('#progress').text("initial call failed");
            $("#go").attr("disabled", "");
            $("#controller").attr("disabled", "");
        },
        success: function(data) {
            var i;
            var deferreds = [];
            for ( i=0; i < data.length; i++ ) {
                applications[data[i].id]=data[i].name
                //console.log("inloop"+i)
                var name = data[i].name
                deferreds.push($.ajax({
                    url: "http"+sec+"://"+domain+"/controller/rest/applications/"+data[i].id+"/nodes?output=json",
                    ind: i,
                    success: function(data2) {
                        //console.log(data2,"return2: "+name)
                        for(var j=0; j<data2.length; j++)
                        {
                            nodes[data2[j].id]={
                                Nodename: data2[j].name,
                                tierid: data2[j].tierId, 
                                appid: data[this.ind].id, 
                                agentType: data2[j].agentType, 
                                agentversion: data2[j].appAgentVersion,
                                machineName: data2[j].machineName
                            }
                            //console.log(data2[j])
                        }
                        $('#progress').text("Processed " + ++count + " out of " + data.length*2 + " Application calls");
                    }
                }));
                deferreds.push($.ajax({
                    url: "http"+sec+"://"+domain+"/controller/rest/applications/"+data[i].id+"/tiers?output=json",
                    success: function(data2) {
                        //console.log(data2,"return2: "+name)
                        for(var j=0; j<data2.length; j++)
                        {
                            tiers[data2[j].id]=data2[j].name
                        }
                        $('#progress').text("Processed " + ++count + " out of " + data.length*2 + " Application calls");
                    }
                }));

            }
            $.when.apply($,deferreds).done(function(){

                //console.log(nodes,applications);
                
                var postarr = [];
                for ( var key in nodes ) {
                    nodes[key].tiername = tiers[nodes[key].tierid];
                    nodes[key].appname = applications[nodes[key].appid];
                    nodes[key].consumesJavaLicense = 0;
                    nodes[key].AppPCAvail = 0;
                    nodes[key].MachPCAvail = 0;
                    postarr.push(key);
                }

                //console.log(JSON.stringify(postarr));
                var url= "http"+sec+"://"+domain+"/controller/restui/appInfra/healthStatsForNodes?time-range=last_5_minutes.BEFORE_NOW.-1.-1.5"; 
                console.log(url);
                $.ajax({
                    url: url,
                    type: "POST",
                    data: JSON.stringify(postarr),
                    headers: {"Content-Type": "application/json;charset=UTF-8"},
                    dataType: "json",
                    success: function(fastdata) {
                        //console.log(fastdata);
                        for (var i=0; i < fastdata.length; i++)
                        {
                            var nodeid = fastdata[i].appServerAgentAvailability.entityId
                            nodes[nodeid].AppPCAvail = fastdata[i].appServerAgentAvailability.percentage;  
                            nodes[nodeid].MachPCAvail = fastdata[i].machineAgentAvailability.percentage;  
                            if (fastdata[i].appServerAgentAvailability.percentage > 0 && nodes[nodeid].agentType.indexOf("JAVA") > -1)
                                nodes[this.keyval].consumesJavaLicense = 1;
                        }

                        console.log(nodes);

                        for ( var key in nodes ) {
                            dataobj[nodes[key].machineName] = {machineName: nodes[key].machineName, agentversion: "", consumesdotNetLicense: 0}
                        }

                        for ( var key in nodes ) {
                            var avail = 0
                            var mavail = 0
                            if (nodes[key].agentversion != "")
                                dataobj[nodes[key].machineName].agentversion = nodes[key].agentversion
                            if (nodes[key].AppPCAvail > 0 )
                                dataobj[nodes[key].machineName].consumesdotNetLicense = 1;
                                avail = 1;
                            if (nodes[key].MachPCAvail > 0 )
                                mavail = 1;

                            newData.push({application: nodes[key].appname, tier: nodes[key].tiername, node: nodes[key].Nodename, available: avail, maavailable: mavail});
                        }

                        console.log(newData);


                        $('#errors').dynatable({
                            dataset: {
                                         records: newData
                                     }
                        });

                        $('#errors').css("display", "block");

                        var str = ConvertToCSV(dataobj);
                        str += '\r\n';
                        str += ConvertToCSV(nodes);
                        //console.log(str);
                        var blob = new Blob([str], {type: "text/csv"});
                        saveAs(blob, ""+domain+".csv");

                    }
                })
                // end of health status calls    
                
                
            });
        }
    });
}

function ConvertToCSV(oa) {
    var str = '';

    var firstline = true
    var topline = ''
    for ( var key in oa ) {
        var line = ''
        for ( var key2 in oa[key] ) {
            if(firstline) {
                if (topline != '') topline += ',';
                topline += key2;
            }
            if (line != '') line += ',';
            line += oa[key][key2];
        }
        if(topline != '' && firstline) {
            str += topline + '\r\n';
            firstline = false;
        }
        str += line + '\r\n';
    }

    return str;
}
