Array.CASEINSENSITIVE = 1;
Array.DESCENDING = 2 ;
Array.UNIQUESORT = 4 ;
Array.RETURNINDEXEDARRAY = 8 ;
Array.NUMERIC = 16 ;

window.sortOn = function ( ar /*Array*/ , propName , options ) 
{
    var sortFunction = function(o1, o2) 
    {
        var v1 = (o1[propName] != undefined) ? o1[propName].valueOf() : "" ;
        var v2 = (o2[propName] != undefined) ? o2[propName].valueOf() : "" ;
        
        function noCase() 
        {
            if (typeof(v1) == "string" || v1 instanceof String) 
            {
                v1 = v1.toLowerCase() ;
            }
            if (typeof(v2) == "string" || v2 instanceof String) 
            {
                v2 = v2.toLowerCase() ;
            }
        }
           
        function numeric() 
        {
            v1 = Number(v1) ;
            v2 = Number(v2) ;
            v1 = isNaN(v1) ? 0 : v1 ;
            v2 = isNaN(v2) ? 0 : v2 ;
        }
        
        function reverse() 
        {
            var tmp = v1 ;
            v1 = v2 ;
            v2 = tmp ;
        }
        
        switch( options ) 
        {
            case Array.CASEINSENSITIVE :
            case Array.CASEINSENSITIVE | Array.RETURNINDEXEDARRAY :
            {
                noCase() ;
                break ;
            }
            case Array.NUMERIC :
            case Array.NUMERIC | Array.RETURNINDEXEDARRAY :
            {
                numeric() ;
                break ;
            }
            case Array.DESCENDING :
            case Array.DESCENDING | Array.RETURNINDEXEDARRAY :
            {
                reverse() ;
                break ;
            }
            case Array.CASEINSENSITIVE | Array.DESCENDING :
            case Array.CASEINSENSITIVE | Array.DESCENDING | Array.RETURNINDEXEDARRAY :
            {
                noCase() ;
                reverse() ;
              break ;
            }    
            case Array.NUMERIC | Array.DESCENDING :
            case Array.NUMERIC | Array.DESCENDING | Array.RETURNINDEXEDARRAY :
            {
                numeric() ;
                reverse() ;
                break ;
            }
            case Array.UNIQUESORT :
            {
                if (v1 == v2) return ;
                break 
            }
        }
       
        if (v1 < v2) 
        {
            return -1 ;
        }
        else if (v1 > v2) 
        {
            return 1 ;
        }
        else 
        {
            return 0 ;
        } 
    }
   
    switch (options) 
    {
        case Array.RETURNINDEXEDARRAY : 
        case Array.RETURNINDEXEDARRAY | Array.NUMERIC :
        case Array.RETURNINDEXEDARRAY | Array.CASEINSENSITIVE :
        case Array.RETURNINDEXEDARRAY | Array.NUMERIC | Array.DESCENDING :
        case Array.RETURNINDEXEDARRAY | Array.CASEINSENSITIVE | Array.DESCENDING :
        {
            var tmp = [].concat(ar) ;
            tmp.sort(sortFunction) ;
            var result = [] ;
            var l = ar.length ;
            for ( var i = 0; i < l; i++ ) 
            {
                var index = tmp.indexOf(ar[i]) ;
                result.push(index) ;
            }
            return result  ;
        }
        default :
        {
            return ar.sort(sortFunction) ;
        }
    }
}