@echo off
echo === Generation du keystore ===
cd /d "%~dp0android\app"

if not exist majordhome-release.keystore (
    keytool -genkeypair -v -storetype PKCS12 ^
        -keystore majordhome-release.keystore ^
        -alias majordhome-key ^
        -keyalg RSA -keysize 2048 -validity 10000 ^
        -storepass MajordHome2026! ^
        -keypass MajordHome2026! ^
        -dname "CN=MajordHome, OU=Dev, O=HomeSync, L=France, ST=France, C=FR"
    echo Keystore cree.
) else (
    echo Keystore existant, on passe.
)

echo.
echo === Build Release APK ===
cd /d "%~dp0android"
call gradlew.bat assembleRelease

echo.
echo === Resultat ===
if exist "%~dp0android\app\build\outputs\apk\release\app-release.apk" (
    echo APK genere avec succes !
    echo Emplacement : android\app\build\outputs\apk\release\app-release.apk
) else (
    echo ERREUR : APK non trouve, verifiez les logs ci-dessus.
)
pause
