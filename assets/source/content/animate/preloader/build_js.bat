for %%k in (".") do set CURRENT_DIR_NAME=%%~nk

node ../formatJS.js -e %CURRENT_DIR_NAME%.js

set "s=%CURRENT_DIR_NAME%"

del /s  "../../../_client/development/images/%CURRENT_DIR_NAME%*"
del /s  "../../../_client/development/libs/%CURRENT_DIR_NAME%*"
 
for /f %%i in ('">$ cmd/v/c echo.!s!& echo $"') do set/a l=%%~zi-2& del $

set number=%l%



xcopy /Y "images" "../../../_client/development/images"
del /s /q "images"

npx google-closure-compiler --js=%CURRENT_DIR_NAME%.js --js_output_file=../../../_client/development/libs/%CURRENT_DIR_NAME%.min.js --language_out ECMASCRIPT6


pause