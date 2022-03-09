pragma solidity 0.6.2;

interface IBroker {
    function subscribe(
        address subscriber, //订阅者
        address publisher, //发布者
        bytes32 topic, //被订阅的消息
        bytes4 handler //消息处理函数
    ) external;

    function unsubscribe(
        address subscriber,
        address publisher,
        bytes32 topic
    ) external;

    function publish(bytes32 topic, bytes calldata data) external;
}
