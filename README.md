# Needle Engine AR 3rd person controller test

This is just a quick test of how to build an AR 3rd person controller with Needle Engine (https://github.com/needle-tools/needle-engine-support). A working prototype can be found here - https://momentous-golden-airplane.glitch.me/

The sample is based on the 3rd person character controller from the Needle samples (https://engine.needle.tools/samples/character-controller/), with a few adjustments. The adjusted scripts can be found at ./Needle/Minimal/src/scripts/. I just expanded the already existing WebXRController with a custom class XRController.ts and XRConterollerValues.ts, to make the controller events easier accessable. Thje XR3rdPersonController.ts is modified copy of the Needle character controller.

This YT video shows, how it looks in action: https://www.youtube.com/watch?v=AW9FcE8_qlA

Pls note that this is just a POC. I won't provide actual support for this, apart from my personal development interests. For any questions about Needle Engine reach out to https://needle.tools/ and join their Discord. The community is lively and really helpful! Great team there :)
