/* global toastr */
(function () {
    "use strict";

    var dashboardApp = angular.module("dashboardApp", ["highcharts-ng"]);

    dashboardApp.controller("dashboardController", ["$scope", "socket", "powerGaugeConfig", "barChartConfig", 
        function ($scope, socket, powerGaugeConfig, barChartConfig) {
            var vm = this;
    
            vm.meterValueAsString = "00000000";
            vm.activeChart = "last24Hours";
            
            function zeroPad(num, places) {
                var zero = places - num.toString().length + 1;
                return Array(+(zero > 0 && zero)).join("0") + num;
            }
    
            function createChartSeries(data) {
                var seriesData = [];
                data.forEach(function (dataRow) {
                    var dateTimeInterval = new Date(dataRow.DateTimeInterval);
                    seriesData.push({ x: dateTimeInterval, y: dataRow.WattHour });
                }, this);
                return seriesData;
            }
            
            function showMessage(message) {
                console.log(message);
                toastr.info(message);
            }
            
            vm.isChartSelected = function (chart) {
                return chart === vm.activeChart;
            };
            
            vm.selectChart = function (chart) {
                vm.activeChart = chart;
                vm.last24HourChart.getHighcharts().series[0].setData(vm.lastData[chart]);
            };

            socket.on("summary", function (summaryData) {
                showMessage("Summary data received");
                var s = String(Math.round(summaryData[0].CalculatedMeterValue * 100));
                vm.meterValueAsString = ("00000000" + s).substring(s.length, s.length + 8);
                vm.powerGauge.getHighcharts().series[0].points[0].update(Math.floor(summaryData[0].UsageInWatt /* * 50 * Math.random() */));
            });

            vm.lastData = {};

            socket.on("last24Hours", function (data) {
                showMessage("Data last 24 hours received");

                var newChartSeries = createChartSeries(data);
                vm.lastData.last24Hours = newChartSeries;
                if(vm.activeChart === "last24Hours") {
                    vm.last24HourChart.getHighcharts().series[0].setData(newChartSeries);
                }
            });
    
            socket.on("lastHour", function (data) {
                showMessage("Data last hour received");

                var newChartSeries = createChartSeries(data);
                vm.lastData.lastHour = newChartSeries;
                if(vm.activeChart === "lastHour") {
                    vm.last24HourChart.getHighcharts().series[0].setData(newChartSeries);
                }
            });
            
            socket.on("last7Days", function (data) {
                showMessage("Data last 7 days received");

                var newChartSeries = createChartSeries(data);
                vm.lastData.last7Days = newChartSeries;
                if(vm.activeChart === "last7Days") {
                    vm.last24HourChart.getHighcharts().series[0].setData(newChartSeries);
                }
            });

            socket.on("last30Days", function (data) {
                showMessage("Data last 30 days received");

                var newChartSeries = createChartSeries(data);
                vm.lastData.last30Days = newChartSeries;
                if(vm.activeChart === "last30Days") {
                    vm.last24HourChart.getHighcharts().series[0].setData(newChartSeries);
                }
            });

            socket.on("last365Days", function (data) {
                showMessage("Data last 365 days received");

                var newChartSeries = createChartSeries(data);
                vm.lastData.last365Days = newChartSeries;
                if(vm.activeChart === "last365Days") {
                    vm.last24HourChart.getHighcharts().series[0].setData(newChartSeries);
                }
            });

            vm.powerGauge = powerGaugeConfig;
            vm.last24HourChart = barChartConfig;
        }
    ]);
    
    dashboardApp.factory('socket', function ($rootScope) {
        var socket = io.connect();
        return {
            on: function (eventName, callback) {
                socket.on(eventName, function () {
                    var args = arguments;
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                });
            },
            emit: function (eventName, data, callback) {
                socket.emit(eventName, data, function () {
                    var args = arguments;
                    $rootScope.$apply(function () {
                        if (callback) {
                            callback.apply(socket, args);
                        }
                    });
                });
            }
        };
    });
    
    dashboardApp.factory('powerGaugeConfig', function () {
        var powerGaugeConfig = {
            options: {
                chart: {
                    type: 'gauge',
                    backgroundColor: 'transparent',
                    animation: {
                        duration: 750
                    }
                },
                
                style: {
                },
 
                tooltip: {
                    enabled: false
                },
                
                credits: false,
                
                exporting: {
                    enabled: false
                },
        
                title: {
                    text: null
                },
                
                plotOptions: {
                    gauge: {
                        dial: {
                            radius: '100%',
                            backgroundColor: 'cornflowerblue',
                            borderColor: 'black',
                            baseWidth: 7,
                            topWidth: 1
                        }
                    }
                },

                pane: {
                    startAngle: -120,
                    endAngle: 120,
                    background: [{
                        borderWidth: 0,
                        backgroundColor: 'transparent'
                    }],
                    size: "90%"
                },
        
                // the value axis
                yAxis: {
                    type: 'logarithmic',
                    min: 10,
                    max: 10000,
        
                    minorTickInterval: 'auto',
                    minorTickWidth: 1,
                    minorTickLength: 19,
                    minorTickPosition: 'outside',
                    minorTickColor: 'gray',
        
                    tickPixelInterval: 100,
                    tickWidth: 1,
                    tickPosition: 'outside',
                    tickLength: -11,
                    tickColor: 'gray',
                    labels: {
                        step: 1,
                        style: {
                            fontFamily: 'Ubuntu Mono',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            color: '#999'
                        }
                    },
                    title: {
                        text: 'Watt',
                        style: {
                            fontFamily: 'Ubuntu Mono',
                            fontSize: '25px',
                            color: 'gray'
                        },
                        x: -2
                        
                    },
                    plotBands: [{
                        from: 10,
                        to: 1000,
                        color: '#8DCA2F', // green
                        innerRadius: '100%',
                        outerRadius: '113%'
                    }, {
                        from: 1000,
                        to: 3000,
                        color: '#FDC702', // yellow
                        innerRadius: '100%',
                        outerRadius: '113%'
                    }, {
                        from: 3000,
                        to: 6000,
                        color: '#FF7700', // orange
                        innerRadius: '100%',
                        outerRadius: '113%'
                    }, {
                        from: 6000,
                        to: 10000,
                        color: '#C50200', // red
                        innerRadius: '100%',
                        outerRadius: '113%'
                    }]
                }

            },

            series: [{
                type: 'gauge',
                name: 'Power',
                data: [ 10 ],
                tooltip: null,
                align: "center",
                dataLabels: {
                    enabled: true,
                    borderWidth: 0,
                    crop: false,
                    format: '{y}',
                    style: {
                        fontFamily: 'Ubuntu Mono',
                        fontWeight: 'normal',
                        fontSize: '22px',
                        textShadow: "none"
                    },
                    x: 0,
                    color: 'gray'
                },
                pivot: {
                    backgroundColor: 'gray'
                }
            }],
            size: {
                height: 360
            }
        };
        
        return powerGaugeConfig;
    });

    dashboardApp.factory('barChartConfig', function () {
        var barChartConfig = {
            options: {
                global: { 
                    useUTC: false 
                },
                chart: {
                    type: 'spline',
                    backgroundColor: 'transparent',
                    animation: {
                        duration: 2500
                    }
                },
                title: {
                    text: null
                },
                legend: {
                    enabled: false
                },
                xAxis: {
                    type: 'datetime'
                },
                yAxis: {
                    type: 'logarithmic',
                    title: {
                        text: 'Average Power Usage (Watt Hour)'
                    }
                },
                tooltip: {
                    headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
                    pointFormat: '<tr>' +
                        '<td style="padding:0"><b>{point.y} Watt Hour</b></td></tr>',
                    footerFormat: '</table>',
                    shared: true,
                    useHTML: true
                }
            },
            series: [{
                data: null,
                groupPadding: 0,
                color: 'cornflowerblue',
                marker: {
                    enabled: false
                },
                states: {
                    hover: {
                        lineWidth: 2
                    }
                }
            }],
            size: {
                height: 330
            }
        };
            
        return barChartConfig;
    });

    dashboardApp.filter('digit', function () {
        return function (input, digit) {
            if (input != undefined) {
                return input.substring(digit, digit + 1);
            }
            else {
                return "";
            }
        }
    });

    dashboardApp.directive("dashboardTile", function () {
        return {
            restrict: "E",
            template: "<div class='tile {{tile.class}}' ng-click='toggleLed({ color: tile.class })'><h3 class='title'>{{tile.title}}</h3><p class='value'>&nbsp;{{tile.value}}{{tile.unit}}</p></div>",
            replace: true,
            scope: {
                tile: "=",
                toggleLed: "&"
            }
        };
    });

    dashboardApp.directive('tabs', function () {
        return {
            restrict: 'E',
            transclude: true,
            scope: {},
            controller: ["$scope", function ($scope) {
                var panes = $scope.panes = [];

                $scope.select = function (pane) {
                    angular.forEach(panes, function (pane) {
                        pane.selected = false;
                    });
                    pane.selected = true;
                }

                this.addPane = function (pane) {
                    if (panes.length == 0) $scope.select(pane);
                    panes.push(pane);
                }
            }],
            template:
            '<div class="tabbable">' +
            '<ul class="nav nav-tabs">' +
            '<li ng-repeat="pane in panes" ng-class="{active:pane.selected}">' +
            '<a href="" ng-click="select(pane)">{{pane.title}}</a>' +
            '</li>' +
            '</ul>' +
            '<div class="tab-content" ng-transclude></div>' +
            '</div>',
            replace: true
        };
    });

    dashboardApp.directive('pane', function () {
        return {
            require: '^tabs',
            restrict: 'E',
            transclude: true,
            scope: { title: '@' },
            link: function (scope, element, attrs, tabsCtrl) {
                tabsCtrl.addPane(scope);
            },
            template:
            '<div class="tab-pane" ng-class="{active: selected}" ng-transclude>' +
            '</div>',
            replace: true
        };
    });
    
    toastr.options = {
        "positionClass": "toast-bottom-right"
    };
} ());