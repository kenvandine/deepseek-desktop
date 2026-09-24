*** Settings ***
Documentation    Test cases for deepseek-desktop snap
Resource         kvm.resource


*** Test Cases ***
DeepSeek Desktop Launches And Renders
    [Documentation]    Verify deepseek-desktop snap launches and renders a UI on Mir
    [Tags]    smoke    yarf:certification_status: blocker
    Log Screenshot
