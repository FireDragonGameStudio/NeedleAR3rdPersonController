(function() {
    const url = window.location.search;
    const urlParams = new URLSearchParams(url);
    if (!urlParams.has('debugconsole')) return;

    const logNode = document.createElement("pre");
    logNode.id = "log";
    const logContainer = document.createElement("div");
    logContainer.id = "log-container";
    logContainer.appendChild(logNode);

    window.addEventListener('DOMContentLoaded', (_) => {
        const arOverlay = document.querySelector('.ar.overlay');
        if(arOverlay)
            arOverlay.appendChild(logContainer);
        else
            document.body.appendChild(logContainer);
    });

    rewireLoggingToElement(
        () => logNode,
        () => logContainer, true);

    window.onError = function(message, source, lineno, colno, error) {
        console.error(message, source, lineno, colno, error);
    }

    console.info("rewired console output");
    console.info("User Agent: " + navigator.userAgent);

    function rewireLoggingToElement(eleLocator, eleOverflowLocator, autoScroll) {
        fixLoggingFunc('log');
        fixLoggingFunc('debug');
        fixLoggingFunc('warn');
        fixLoggingFunc('error');
        fixLoggingFunc('info');
    
        function fixLoggingFunc(name) {
            console['old' + name] = console[name];
            console[name] = function(...args) {
                const output = produceOutput(name, args);
                const eleLog = eleLocator();
    
                if (autoScroll) {
                    const eleContainerLog = eleOverflowLocator();
                    const isScrolledToBottom = eleContainerLog.scrollHeight - eleContainerLog.clientHeight <= eleContainerLog.scrollTop + 1;
                    eleLog.innerHTML += output + "<br>";
                    if (isScrolledToBottom) {
                        eleContainerLog.scrollTop = eleContainerLog.scrollHeight - eleContainerLog.clientHeight;
                    }
                } else {
                    eleLog.innerHTML += output + "<br>";
                }
    
                console['old' + name].apply(undefined, args);
            };
        }
    
        function produceOutput(name, args) {
            return args.reduce((output, arg) => {
                try {
                    return output +
                        "<span class=\"log-" + (typeof arg) + " log-" + name + "\">" +
                            (typeof arg === "object" && (JSON || {}).stringify ? JSON.stringify(arg) : arg) +
                        "</span>&nbsp;";
                }
                catch(ex) {
                    console.error("exception when logging: " + ex);
                }
            }, '');
        }
    }
    /*
    setInterval(() => {
      const method = (['log', 'debug', 'warn', 'error', 'info'][Math.floor(Math.random() * 5)]);
      console[method](method, 'logging something...'); 
    }, 200);
    */
})();